
import time
import sys
import logging
import json
from datetime import datetime, timedelta
from threading import Thread

# Proje kök dizinini path'e ekle
import os
sys.path.append(os.getcwd())

from sqlalchemy import or_, and_
from sqlalchemy.dialects.postgresql import insert as pg_insert

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
# ne 'success'). Tek client için en kötü senaryoda (3 deneme x 120sn bekleme + istek
# timeout'ları) birkaç dakikayı geçmiyor - bunun bariz üstünde bir eşik, çökme sonrası
# satırı da retry edilebilir hale getiriyor.
STALE_PENDING_MINUTES = 20

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
                db.query(RewardPayout).filter(RewardPayout.id == payout_row_id).update({"status": "pending_claim"})
                db.commit()
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

                MAX_ATTEMPTS = 3
                resp = None
                last_err = None
                for attempt in range(1, MAX_ATTEMPTS + 1):
                    try:
                        resp = _call_bapi()
                        last_err = None
                        break  # Başarılı — döngüden çık
                    except Exception as attempt_err:
                        last_err = attempt_err
                        if attempt < MAX_ATTEMPTS:
                            logger.warning(
                                f"Client {client_id} deneme {attempt}/{MAX_ATTEMPTS} başarısız: {attempt_err}. "
                                f"2 dakika bekleniyor..."
                            )
                            time.sleep(120)
                        else:
                            logger.error(f"Client {client_id} {MAX_ATTEMPTS} denemede de ödül gönderilemedi: {attempt_err}")

                if last_err is not None:
                    raise last_err  # Tüm denemeler bitti, dış except'e düş

                job_results[user_str].append({
                    "rule": rule_snapshot,
                    "status": "success",
                    "response": resp,
                    "timestamp": datetime.utcnow().isoformat()
                })
                logger.info(f"   [REWARD_DIAGNOSTIC] Client {client_id} rewarded SUCCESS.")
                success_count += 1
                worker_log.saved_count = success_count
                db.query(RewardPayout).filter(RewardPayout.id == payout_row_id).update({
                    "status": "success", "bapi_response": resp, "sent_at": datetime.utcnow()
                })
                db.commit()

            except Exception as e:
                logger.error(f"Failed to reward Client {client_id} after 3 attempts: {e}")
                job_results[user_str].append({
                    "rule": rule_snapshot,
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
                fail_count += 1
                try:
                    db.query(RewardPayout).filter(RewardPayout.id == payout_row_id).update({
                        "status": "failed", "error_message": str(e)
                    })
                    db.commit()
                except Exception as payout_update_err:
                    logger.error(f"reward_payouts durumu 'failed' olarak güncellenemedi (client={client_id}): {payout_update_err}")
                    db.rollback()

            # Kullanıcılar arası normal geçiş bekleme süresi
            logger.info("4 saniye bekleniyor...")
            time.sleep(4)

        # İş durumu güncelle (Tamamlandı)
        job.results = job_results
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        
        worker_log.status = "completed"
        worker_log.completed_at = datetime.utcnow()
        db.commit()
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
