
import time
import sys
import logging
import json
from datetime import datetime, timedelta
from threading import Thread
from typing import Optional

# Proje kök dizinini path'e ekle
import os
sys.path.append(os.getcwd())

from sqlalchemy import or_, and_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm.attributes import flag_modified

from shared.database import SessionLocal, get_retrying_session
from shared.models.reward_job import RewardJob
from shared.models.reward_payout import RewardPayout
from shared.models.event import Event
from shared.models.worker_log import WorkerLog
from shared.domain.reward_distribution import compute_reward_distribution_plan
from backend_api.app.services.bapi_client import BapiClient
from shared.settings import settings

# Loglama Ayarları
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("reward_worker.log", encoding='utf-8')
    ]
)
logger = logging.getLogger("reward_worker")

# Bir reward_payouts satırı, worker gönderim ortasında çökerse/yeniden başlatılırsa
# 'pending' durumunda sonsuza kadar kilitli kalabilir (ne 'failed' gibi retry edilebilir,
# ne 'success'). Tek client için en kötü senaryoda (2 deneme x 180sn bekleme + istek
# timeout'ları) birkaç dakikayı geçmiyor - bunun bariz üstünde bir eşik, çökme sonrası
# satırı da retry edilebilir hale getiriyor.
STALE_PENDING_MINUTES = 20

# cash/bonus BAPI çağrısı başarısız olursa: en fazla 2 deneme, aralarda 3 dakika bekleme.
MAX_ATTEMPTS = 2
RETRY_WAIT_SECONDS = 180

# BAPI 401 (token geçersiz/süresi dolmuş) retry ile ASLA düzelmez - token .env'de elle
# düzeltilene kadar kalan HER client aynı hatayı alır. Bunu normal 'failed' gibi işleyip
# devam etmek, 200 kişilik bir job'ta saatlerce (180sn x 2 deneme x kalan kişi) boşa zaman
# harcar. Bu yüzden 401 görülür görülmez: (1) o client için 2. denemeyi hiç beklemiyoruz,
# (2) job'u erkenden durduruyoruz - işlenmemiş client'lara hiç reward_payouts satırı
# açılmadığı için, token düzeltilip event için job tekrar tetiklendiğinde sorunsuz devam eder.
AUTH_ERROR_STATUS_CODE = 401

# BAPI 403 (rate limit) ve 500 (geçici sunucu yükü) genelde bir süre sonra kendini
# toparlıyor (bkz. shared/domain/reward_claim.py'deki aynı sezgisel cooldown, orada
# freebet/spin claim'leri için zaten uygulanıyor). Böyle bir hatadan sonra client'ı
# 'failed' yazıp sıradakine geçmek yerine, AYNI client için COOLDOWN_SECONDS bekleyip
# tekrar deniyoruz - sıradaki client'a geçmenin bir faydası yok, o da aynı limite çarpar.
# MAX_COOLDOWN_ROUNDS ile sınırlı ki BAPI gerçekten uzun süreli kesintideyse tek bir
# client job'u sonsuza kadar kilitlemesin - tur sayısı tükenirse client 'failed' yazılır.
COOLDOWN_STATUS_CODES = (403, 500)
COOLDOWN_SECONDS = 130
MAX_COOLDOWN_ROUNDS = 3


def _bapi_status_code(err: Exception) -> Optional[int]:
    resp = getattr(err, "response", None)
    return getattr(resp, "status_code", None) if resp is not None else None


def _is_auth_error(err: Exception) -> bool:
    return _bapi_status_code(err) == AUTH_ERROR_STATUS_CODE


def _is_cooldown_error(err: Exception) -> bool:
    code = _bapi_status_code(err)
    if code in COOLDOWN_STATUS_CODES:
        return True
    # _parse_response HasError:true ise ValueError fırlatıyor, BetConstruct rate limitini
    # bazen HTTP 403 yerine gövdede "403 ... request limit" mesajıyla da bildiriyor.
    msg = str(err).lower()
    return "403" in msg and "request lim" in msg


def _persist_payout_outcome(db, job, job_id: int, payout_row_id, payout_update: dict, job_results: dict, is_critical: bool = False):
    """job.results (JSONB) + ilgili reward_payouts satırını TEK yerde, birlikte kaydeder.

    İki sorunu birden çözer:
    1) job.results eskiden sadece job'un en sonunda yazılıyordu - worker ortada çökerse
       (OOM/kill/restart) o ana kadarki tüm sonuçlar kaybolurdu. Şimdi her payout sonrası
       kalıcı yazılıyor.
    2) Supabase pooler ani bağlantı kopmaları (bkz. shared/database.py) tam BAPI çağrısı
       BAŞARILI olduktan hemen sonraki commit anında olursa, eskiden bu durum yanlışlıkla
       "gönderim başarısız" sayılıp satır 'failed' yazılırdı - halbuki ödül/para zaten
       gönderilmişti. Bu, satırın daha sonra 'stale pending' sayılıp TEKRAR gönderilmesine
       (çift ödeme) yol açabilirdi. Şimdi commit başarısız olursa taze bir bağlantıyla bir
       kez daha deneniyor; is_critical=True (BAPI çağrısı gerçekten tamamlandıktan sonra)
       iken bu da başarısız olursa 'failed' YAZILMIYOR - sadece CRITICAL loglanıyor, çünkü
       'failed' yazmak retry'ye (=çift ödeme) açık kapı bırakır.

    Kullanılmakta olan (db, job) çiftini döner - taze bağlantıya geçilmişse çağıran taraf
    bundan sonra bu ikiliyi kullanmaya devam etmeli (aynı job objesi eski/kopuk session'a
    bağlı kalmasın diye).
    """
    try:
        job.results = job_results
        flag_modified(job, "results")
        if payout_update:
            db.query(RewardPayout).filter(RewardPayout.id == payout_row_id).update(payout_update)
        db.commit()
        return db, job
    except Exception as db_err:
        logger.error(
            f"Job {job_id}: sonuç kaydı yazılamadı ({db_err}), taze bağlantıyla tekrar deneniyor..."
        )
        try:
            db.rollback()
        except Exception:
            pass
        try:
            fresh = get_retrying_session()
            fresh_job = fresh.query(RewardJob).filter(RewardJob.id == job_id).first()
            if fresh_job is None:
                raise RuntimeError(f"RewardJob {job_id} taze bağlantıda bulunamadı")
            fresh_job.results = job_results
            flag_modified(fresh_job, "results")
            if payout_update:
                fresh.query(RewardPayout).filter(RewardPayout.id == payout_row_id).update(payout_update)
            fresh.commit()
            logger.info(f"Job {job_id}: taze bağlantıyla sonuç kaydı başarıyla yazıldı.")
            try:
                db.close()
            except Exception:
                pass
            return fresh, fresh_job
        except Exception as fresh_err:
            log_fn = logger.critical if is_critical else logger.error
            extra = (
                " ÖDÜL/PARA BAPI'YE BAŞARIYLA GÖNDERİLDİ AMA HİÇBİR KAYITTA GÖRÜNMÜYOR - "
                "reward_payouts satırını ELLE 'success' yapın, aksi halde bu client'a "
                "sonraki bir job'da (stale-pending sayılıp) İKİNCİ KEZ gönderim yapılabilir."
                if is_critical else ""
            )
            log_fn(f"Job {job_id}: taze bağlantıyla da yazılamadı ({fresh_err}).{extra}")
            return db, job


def process_job(job_id: int):
    db = get_retrying_session()
    # Create a progress log entry in WorkerLog for visibility in Admin Panel
    worker_log = WorkerLog(status="running")
    try:
        job = db.query(RewardJob).filter(RewardJob.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found!")
            worker_log.status = "failed"
            worker_log.error_message = f"RewardJob {job_id} not found"
            db.add(worker_log)
            db.commit()
            return

        worker_log.event_id = job.event_id
        db.add(worker_log)
        db.commit()
        db.refresh(worker_log)

        logger.info(f"Starting Job {job_id} for Event {job.event_id}")
        job.status = "processing"
        db.commit()

        event = db.query(Event).filter(Event.id == job.event_id).first()
        if not event:
            raise ValueError(f"Event {job.event_id} not found")

        # Kimin ne alacağını admin önizlemesiyle AYNI fonksiyondan hesapla (kural eşleşmesi +
        # admin'in elle yaptığı miktar değişikliği/ekleme/çıkarma burada tek yerde uygulanır).
        plan = compute_reward_distribution_plan(db, event.id)
        payouts = plan.get("payouts", [])
        job_results = job.results or {}

        if not payouts:
            logger.info(f"   [REWARD_DIAGNOSTIC] No payouts for event {event.id}. Completing job.")
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            db.commit()
            return

        # Kickoff gibi turnuvalarin yogun taramasindan izole olsun diye odul dagitimi
        # ayri (STATS) token kullaniyor - BAPI_TOKEN worker taramasina ozgu kalsin.
        bapi = BapiClient(token=settings.STATS_BAPI_TOKEN)
        success_count = 0
        fail_count = 0
        job_aborted_reason = None
        logger.info(f"   [REWARD_DIAGNOSTIC] Found {plan.get('participant_count')} participants, {len(payouts)} payouts to send.")

        # Update initial count expectation
        worker_log.processed_count = 0
        db.commit()

        for payout in payouts:
            client_id = payout["client_id"]
            user_str = str(client_id)
            amount = payout["amount"]
            rule_type = payout["reward_type"]
            partner_bonus_id = payout.get("partner_bonus_id")

            worker_log.processed_count += 1
            db.commit()

            if user_str not in job_results:
                job_results[user_str] = []

            rule_snapshot = {
                "reward_type": rule_type,
                "amount": amount,
                "criteria_type": payout.get("criteria_type"),
                "criteria_value": payout.get("criteria_value"),
                "partner_bonus_id": partner_bonus_id,
            }

            # --- Çift ödeme koruması -------------------------------------------------
            # reward_payouts.(event_id, client_id) üzerinde UNIQUE kısıt var. Bu insert
            # (ON CONFLICT ile) atomik bir "kilit al" denemesidir:
            #   - Kayıt hiç yoksa: yeni satır oluşur, gönderime devam edilir.
            #   - Kayıt "failed" durumundaysa: satır bu job'a devredilir (retry), devam edilir.
            #   - Kayıt "pending" ama STALE_PENDING_MINUTES'ten eskiyse (worker gönderim
            #     ortasında çökmüş/yeniden başlatılmış demektir): aynı şekilde devredilir,
            #     yoksa satır sonsuza kadar kilitli kalır, ne retry edilebilir ne fark edilir.
            #   - Kayıt "success"/"pending_claim" ya da taze "pending" ise: WHERE eşleşmez,
            #     RETURNING boş döner -> bu client bu job'da ATLANIR.
            # Job tekrarında (retry/çift tıklama/iki job) aynı client'a ikinci kez BAPI
            # çağrısı gitmesini veritabanı seviyesinde engeller - iki worker aynı anda
            # çalışsa bile UNIQUE kısıt sayesinde ikisi de aynı client'ı "kazanamaz".
            raw_cv = payout.get("criteria_value")
            try:
                criteria_value_f = float(raw_cv) if raw_cv is not None else None
            except (TypeError, ValueError):
                criteria_value_f = None

            stale_pending_cutoff = datetime.utcnow() - timedelta(minutes=STALE_PENDING_MINUTES)

            _insert = pg_insert(RewardPayout).values(
                event_id=event.id,
                reward_job_id=job.id,
                client_id=client_id,
                reward_type=rule_type,
                amount=amount,
                criteria_type=payout.get("criteria_type"),
                criteria_value=criteria_value_f,
                partner_bonus_id=partner_bonus_id,
                status="pending",
                attempt_count=1,
            )
            _upsert = _insert.on_conflict_do_update(
                index_elements=["event_id", "client_id"],
                set_={
                    "reward_job_id": _insert.excluded.reward_job_id,
                    "reward_type": _insert.excluded.reward_type,
                    "amount": _insert.excluded.amount,
                    "criteria_type": _insert.excluded.criteria_type,
                    "criteria_value": _insert.excluded.criteria_value,
                    "partner_bonus_id": _insert.excluded.partner_bonus_id,
                    "status": "pending",
                    "attempt_count": RewardPayout.attempt_count + 1,
                },
                where=or_(
                    RewardPayout.status == "failed",
                    and_(RewardPayout.status == "pending", RewardPayout.created_at < stale_pending_cutoff),
                ),
            ).returning(RewardPayout.id)

            payout_row_id = db.execute(_upsert).scalar()
            db.commit()

            if payout_row_id is None:
                logger.warning(
                    f"   [REWARD_DIAGNOSTIC] Client {client_id} bu event için zaten işlenmiş "
                    f"(reward_payouts: success/pending_claim) — ATLANIYOR, tekrar gönderilmiyor."
                )
                job_results[user_str].append({
                    "rule": rule_snapshot,
                    "status": "skipped_duplicate",
                    "note": "Bu client için ödül daha önce başka bir dağıtımda işlenmiş, tekrar gönderilmedi.",
                    "timestamp": datetime.utcnow().isoformat()
                })
                db, job = _persist_payout_outcome(db, job, job_id, payout_row_id, {}, job_results)
                continue
            # --- /Çift ödeme koruması --------------------------------------------------

            # Freebet/Freespin artık burada otomatik gönderilmiyor: kullanıcı client tarafında
            # "Ödülünü Al" butonuna basıp bonus uygunluk kontrollerinden geçince gönderiliyor
            # (bkz. shared/domain/reward_claim.py). Worker sadece kuyruğa yazıyor.
            if rule_type in ('spin', 'freebet'):
                job_results[user_str].append({
                    "rule": rule_snapshot,
                    "status": "pending_claim",
                    "timestamp": datetime.utcnow().isoformat()
                })
                db, job = _persist_payout_outcome(
                    db, job, job_id, payout_row_id, {"status": "pending_claim"}, job_results
                )
                logger.info(f"   [REWARD_DIAGNOSTIC] Client {client_id} {rule_type} PENDING_CLAIM (kullanıcı client'tan alacak).")
                continue

            try:
                logger.info(f"Distributing {amount} {rule_type} to Client {client_id}")
                event_context = event.slug if event else (job.event_name_snapshot or "DeletedEvent")
                info_msg = f"EventReward:{event_context} Type:{rule_type} Rank:{payout['rank']} Pts:{payout['points']}"

                def _call_bapi():
                    if rule_type == 'cash':
                        return bapi.send_cash_reward(
                            client_id=client_id,
                            amount=amount,
                            info=info_msg
                        )
                    elif rule_type == 'bonus':
                        if not partner_bonus_id:
                            logger.error(f"Missing partner_bonus_id for {rule_type} rule!")
                            raise ValueError(f"Missing partner_bonus_id for {rule_type}")
                        return bapi.add_client_to_bonus(
                            client_id=client_id,
                            amount=amount,
                            bonus_id=partner_bonus_id,
                            bonus_type=1,
                            note=info_msg
                        )
                    raise ValueError(f"Unknown rule_type: {rule_type}")

                resp = None
                last_err = None
                cooldown_round = 0
                while True:
                    for attempt in range(1, MAX_ATTEMPTS + 1):
                        try:
                            resp = _call_bapi()
                            last_err = None
                            break  # Başarılı — döngüden çık
                        except Exception as attempt_err:
                            last_err = attempt_err
                            if _is_auth_error(attempt_err):
                                # 401 - token geçersiz, 2. denemeyi beklemenin anlamı yok.
                                logger.error(f"Client {client_id}: BAPI 401 (yetkisiz) - tekrar denenmeden bırakılıyor.")
                                break
                            if attempt < MAX_ATTEMPTS:
                                logger.warning(
                                    f"Client {client_id} deneme {attempt}/{MAX_ATTEMPTS} başarısız: {attempt_err}. "
                                    f"3 dakika bekleniyor..."
                                )
                                time.sleep(RETRY_WAIT_SECONDS)
                            else:
                                logger.error(f"Client {client_id} {MAX_ATTEMPTS} denemede de ödül gönderilemedi: {attempt_err}")

                    if last_err is None:
                        break  # Başarılı

                    # 403/500 (rate limit/geçici yük): AYNI client'ı vazgeçmeden önce birkaç
                    # tur daha, aralara soğuma koyarak dene - client'ı 'failed' yazıp sıradakine
                    # geçmek yerine burada ısrar ediyoruz (sıradaki client de nasılsa aynı
                    # limite çarpar, bu client'ı atlamanın bir faydası yok). Sonsuz döngüye
                    # girmesin diye MAX_COOLDOWN_ROUNDS ile sınırlı - o kadar tur da geçemezse
                    # (BAPI gerçekten uzun süreli kesintide demektir) client 'failed' yazılır,
                    # admin panelinden elle takip edilir.
                    if _is_cooldown_error(last_err) and cooldown_round < MAX_COOLDOWN_ROUNDS:
                        cooldown_round += 1
                        logger.warning(
                            f"Client {client_id}: BAPI 403/500, {MAX_ATTEMPTS} denemede de başarısız - "
                            f"{COOLDOWN_SECONDS}sn soğuyup AYNI client'a tekrar denenecek "
                            f"(soğuma turu {cooldown_round}/{MAX_COOLDOWN_ROUNDS})..."
                        )
                        time.sleep(COOLDOWN_SECONDS)
                        continue  # aynı client'ı yeniden dene

                    break  # 401, başka bir hata türü, ya da soğuma turları tükendi

                if last_err is not None:
                    raise last_err  # Tüm denemeler/turlar bitti, dış except'e düş

                job_results[user_str].append({
                    "rule": rule_snapshot,
                    "status": "success",
                    "response": resp,
                    "timestamp": datetime.utcnow().isoformat()
                })
                logger.info(f"   [REWARD_DIAGNOSTIC] Client {client_id} rewarded SUCCESS.")
                success_count += 1
                worker_log.saved_count = success_count
                # is_critical=True: BAPI çağrısı burada zaten BAŞARIYLA tamamlandı (para/bonus
                # gitti) - kayıt yazımı başarısız olursa bunu asla 'failed' saymıyoruz, aksi
                # halde satır daha sonra stale-pending sayılıp ikinci kez gönderilebilir.
                db, job = _persist_payout_outcome(
                    db, job, job_id, payout_row_id,
                    {"status": "success", "bapi_response": resp, "sent_at": datetime.utcnow()},
                    job_results, is_critical=True,
                )

            except Exception as e:
                logger.error(f"Failed to reward Client {client_id} after {MAX_ATTEMPTS} attempts: {e}")
                job_results[user_str].append({
                    "rule": rule_snapshot,
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
                fail_count += 1
                db, job = _persist_payout_outcome(
                    db, job, job_id, payout_row_id,
                    {"status": "failed", "error_message": str(e)},
                    job_results,
                )

                if _is_auth_error(e):
                    # Token .env'de elle düzeltilmeden kalan client'ların hiçbiri geçmeyecek -
                    # aynı hatayı 180sn x 2 deneme ile tekrar tekrar yaşamak yerine job'u
                    # burada durduruyoruz. Henüz sırası gelmemiş client'lara reward_payouts
                    # satırı hiç açılmadı - token düzeltilip event için job tekrar
                    # tetiklendiğinde bu client'lar (ve bu client de, satırı 'failed' olduğu
                    # için) sorunsuz yeniden denenir.
                    job_aborted_reason = (
                        f"BAPI 401 (yetkisiz) alındı - token geçersiz/süresi dolmuş görünüyor. "
                        f"Client {client_id}'den sonraki client'lar işlenmeden durduruldu. "
                        f".env dosyasındaki BAPI_TOKEN/STATS_BAPI_TOKEN kontrol edilip event "
                        f"için ödül dağıtımı tekrar tetiklenmeli."
                    )
                    logger.critical(f"Job {job_id}: {job_aborted_reason}")
                    break
                # 403/500 için soğuma + aynı client'a tekrar deneme yukarıdaki while
                # döngüsünde zaten yapıldı (MAX_COOLDOWN_ROUNDS turu da tükendiyse buraya
                # düşer) - burada ekstra bir şey yapmadan normal 'failed' akışı devam eder.

            # Kullanıcılar arası normal geçiş bekleme süresi
            logger.info("4 saniye bekleniyor...")
            time.sleep(4)

        # İş durumu güncelle (Tamamlandı / Erken durduruldu)
        job.results = job_results
        job.status = "failed" if job_aborted_reason else "completed"
        if job_aborted_reason:
            job.error_message = job_aborted_reason
        job.completed_at = datetime.utcnow()

        worker_log.status = "failed" if job_aborted_reason else "completed"
        if job_aborted_reason:
            worker_log.error_message = job_aborted_reason
        worker_log.completed_at = datetime.utcnow()
        db.commit()
        if job_aborted_reason:
            logger.error(f"Job {job_id} erken durduruldu. Success: {success_count}, Failed: {fail_count}. Sebep: {job_aborted_reason}")
        else:
            logger.info(f"Job {job_id} completed. Success: {success_count}, Failed: {fail_count}")

    except Exception as e:
        logger.error(f"Job {job_id} failed with error: {e}")
        try:
            job.status = "failed"
            job.error_message = str(e)
            job.results = job_results  # O ana kadar kime ne gönderildiğinin kaydı - çift ödeme riskini önler
            worker_log.status = "failed"
            worker_log.error_message = str(e)
            db.commit()
        except Exception as commit_err:
            # Orijinal bağlantı da kopmuş olabilir (ör. SSL connection closed).
            # Sessizce yutmak yerine taze bir bağlantıyla tekrar dene - aksi halde job
            # "processing" durumunda asılı kalır ve kime ödeme gittiği kaydı kaybolur.
            logger.error(f"Job {job_id} failure state kaydedilemedi ({commit_err}), taze bağlantıyla tekrar deneniyor...")
            try:
                db.rollback()
            except Exception:
                pass
            try:
                fresh_db = get_retrying_session()
                try:
                    fresh_job = fresh_db.query(RewardJob).filter(RewardJob.id == job_id).first()
                    fresh_log = fresh_db.query(WorkerLog).filter(WorkerLog.id == worker_log.id).first()
                    if fresh_job:
                        fresh_job.status = "failed"
                        fresh_job.error_message = str(e)
                        fresh_job.results = job_results
                    if fresh_log:
                        fresh_log.status = "failed"
                        fresh_log.error_message = str(e)
                    fresh_db.commit()
                finally:
                    fresh_db.close()
            except Exception as retry_err:
                logger.error(f"Job {job_id} failure state taze bağlantıyla da kaydedilemedi: {retry_err}")
    finally:
        db.close()

def run_worker():
    logger.info("Reward Worker Started. Polling for jobs...")
    while True:
        db = get_retrying_session()
        try:
            # Find pending job
            job = db.query(RewardJob).filter(RewardJob.status == "pending").first()
            if job:
                logger.info(f"Bekleyen iş bulundu: {job.id}")
                # Veritabanı oturumunu kapatıp işlemi başlat
                job_id = job.id
                db.close() 
                process_job(job_id)
            else:
                db.close()
                time.sleep(5)
        except Exception as e:
            logger.error(f"Worker Loop Error: {e}")
            if db: db.close()
            time.sleep(5)

if __name__ == "__main__":
    run_worker()
