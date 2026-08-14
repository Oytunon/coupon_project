"""
Freebet/Freespin ödülleri artık reward_worker tarafından otomatik gönderilmiyor;
worker bunları 'pending_claim' olarak reward_jobs.results içine yazıyor
(bkz. reward_worker.py), kullanıcı client tarafında "Ödülünü Al" butonuna basınca
bu modül devreye giriyor: bonus uygunluk kontrollerini çalıştırır, geçerse gerçek
BAPI çağrısını yapıp aynı kaydı 'success'/'failed' olarak günceller.
"""
import logging
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any, Callable, Dict, Optional, Tuple

import requests
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from shared.models.reward_job import RewardJob

logger = logging.getLogger("reward_claim")

if TYPE_CHECKING:
    from backend_api.app.services.bapi_client import BapiClient

CLAIMABLE_REWARD_TYPES = ("freebet", "spin")
CLAIMABLE_STATUSES = ("pending_claim", "failed")

# BetConstruct'ın bakiye/aktif-bahis/bonus kontrol uçları (GetClients, GetBetHistory,
# GetClientBonuses) sık çağrılınca 403 + "birkaç dakika sonra dene" diyor — bkz.
# shared/services/bapi.py:fetch_client_id_by_login, aynı sorun orada da var, aynı
# yöntemle (proaktif min aralık + 403 sonrası cooldown) çözülmüş. Turnuva bitince
# birçok kazanan aynı anda "Ödülünü Al"a basarsa burada da yığılma olabileceği için
# aynı korumayı burada da uyguluyoruz. Not: bu process-içi (module-level) bir koruma —
# birden fazla API worker process'i varsa her biri kendi sayacını tutar.
_CHECK_MIN_INTERVAL_SEC = 4
_CHECK_COOLDOWN_SEC = 130
_last_check_at: Optional[datetime] = None
_cooldown_until: Optional[datetime] = None


def _rate_limit_wait_reason() -> Optional[str]:
    """Şu an yeni bir kontrol denemesi yapılabilir mi? Değilse kullanıcıya gösterilecek mesajı döner."""
    global _last_check_at
    now = datetime.utcnow()
    if _cooldown_until and now < _cooldown_until:
        remaining = max(1, int((_cooldown_until - now).total_seconds()))
        return f"Sistem şu an yoğun, lütfen {remaining} saniye sonra tekrar deneyin."
    if _last_check_at and (now - _last_check_at).total_seconds() < _CHECK_MIN_INTERVAL_SEC:
        return "Çok sık deneniyor, lütfen birkaç saniye sonra tekrar deneyin."
    _last_check_at = now
    return None


def _mark_rate_limited() -> None:
    global _cooldown_until
    _cooldown_until = datetime.utcnow() + timedelta(seconds=_CHECK_COOLDOWN_SEC)


def _is_rate_limit_error(e: Exception) -> bool:
    if isinstance(e, requests.exceptions.HTTPError) and getattr(e.response, "status_code", None) == 403:
        return True
    # _parse_response HasError:true ise ValueError fırlatıyor; BetConstruct rate limiti
    # bazen HTTP 403 yerine gövdede "403 ... request limit" gibi bir mesajla da bildiriyor
    # (bkz. backend_api/app/main.py:141 — aynı sezgisel kontrol).
    msg = str(e).lower()
    return "403" in msg and "request lim" in msg


def _run_check(step_name: str, fn: Callable[[], Any]) -> Tuple[Any, Optional[str]]:
    """fn()'i çalıştırır. Rate limit hatasıysa cooldown'u işaretler; her hata durumunda
    (sonuç=None, sebep) döner, başarılıysa (sonuç, None).

    Ham exception metni kullanıcıya HİÇ gösterilmiyor (teknik detay, bazen sunucu/altyapı
    bilgisi sızdırabilir) — sadece loglanıyor, kullanıcıya genel/anlaşılır bir mesaj dönüyor.
    """
    try:
        return fn(), None
    except Exception as e:
        if _is_rate_limit_error(e):
            _mark_rate_limited()
            return None, f"Sistem şu an yoğun, lütfen {_CHECK_COOLDOWN_SEC} saniye sonra tekrar deneyin."
        logger.error(f"{step_name} başarısız: {e}")
        return None, f"{step_name} şu anda yapılamadı, lütfen birazdan tekrar deneyin."


def check_bonus_eligibility(bapi: "BapiClient", client_id: int) -> Tuple[bool, Optional[str]]:
    """
    Golcu (C:\\...\\repo\\gol\\golcu) reposundaki 3 kontrolün birebir aynısı:
    bakiye < 5 TL, son 7 günde aktif bahis yok, kullanılmamış (ResultType=0) bonus yok.
    Sırayla çalışır, ilk başarısız olanın sebebini döner.
    """
    wait_reason = _rate_limit_wait_reason()
    if wait_reason:
        return False, wait_reason

    balance, err = _run_check("Bakiye kontrolü", lambda: bapi.get_client_balance(client_id))
    if err:
        return False, err
    if balance >= 5:
        return False, f"Bakiyeniz ({balance:.2f} TL) bu ödül için uygun değil — bakiyenizin 5 TL altında olması gerekiyor."

    has_bet, err = _run_check("Aktif bahis kontrolü", lambda: bapi.has_active_bet(client_id))
    if err:
        return False, err
    if has_bet:
        return False, "Son 7 gün içinde aktif bahsiniz olduğu için şu an ödülünüzü alamıyorsunuz."

    has_bonus, err = _run_check("Bonus kontrolü", lambda: bapi.has_usable_bonus(client_id))
    if err:
        return False, err
    if has_bonus:
        return False, "Zaten kullanılmamış/aktif bir bonusunuz var, önce onu kullanmanız gerekiyor."

    return True, None


def _locate_entry(db: Session, event_id: int, client_id: int, for_update: bool = False) -> Optional[Tuple[RewardJob, int]]:
    """Bu event'teki tüm RewardJob'ları tarar, en güncel (timestamp'e göre) claim
    edilebilir freebet/spin girdisinin (job, results[client_id] içindeki index) hâlini döner.

    for_update=True ile satır(lar) DB seviyesinde kilitlenir (SELECT ... FOR UPDATE) — aynı
    kullanıcı için aynı anda gelen iki claim isteğinin ikisinin de gerçek BAPI çağrısı
    yapmasını (çift ödül gönderimini) engellemek için claim_pending_reward bunu kullanır.
    İkinci istek, ilk istek commit/rollback edene kadar burada bekler; ilki bitince satırı
    tekrar okur ve durum artık 'success' olduğu için (CLAIMABLE_STATUSES dışında kalır)
    kendisi 'not_found' döner — tekrar gönderim yapmaz.
    """
    query = db.query(RewardJob).filter(RewardJob.event_id == event_id)
    if for_update:
        query = query.with_for_update()
    jobs = query.all()
    client_str = str(client_id)
    best: Optional[Tuple[str, RewardJob, int]] = None

    for job in jobs:
        results = job.results or {}
        entries = results.get(client_str) or []
        if not isinstance(entries, list):
            continue
        for idx, entry in enumerate(entries):
            if not isinstance(entry, dict):
                continue
            rule = entry.get("rule") or {}
            if rule.get("reward_type") not in CLAIMABLE_REWARD_TYPES:
                continue
            if entry.get("status") not in CLAIMABLE_STATUSES:
                continue
            ts = entry.get("timestamp") or ""
            if best is None or ts > best[0]:
                best = (ts, job, idx)

    if best is None:
        return None
    return best[1], best[2]


def find_pending_claim(db: Session, event_id: int, client_id: int) -> Optional[Dict[str, Any]]:
    """Client'a gösterilecek özet: claim edilebilir bir ödül var mı, varsa ne."""
    found = _locate_entry(db, event_id, client_id)
    if not found:
        return None
    job, idx = found
    entry = (job.results or {}).get(str(client_id), [])[idx]
    rule = entry.get("rule") or {}
    return {
        "status": entry.get("status"),
        "reward_type": rule.get("reward_type"),
        "amount": rule.get("amount"),
        "last_error": entry.get("error"),
        # Kontrol (bakiye/aktif bahis/kullanılmamış bonus) geçilemediğinde bunu buraya
        # kalıcı yazıyoruz — kullanıcı sayfayı yenilese de "neden alamadım" görünsün.
        "last_check_failure": entry.get("last_check_failure"),
    }


def claim_pending_reward(db: Session, bapi: "BapiClient", event_id: int, client_id: int) -> Dict[str, Any]:
    """
    Bekleyen freebet/spin kaydını bulur, uygunluk kontrollerini çalıştırır, geçerse
    gerçek ödülü gönderir ve aynı kaydı günceller (yeni satır eklemez).

    Satır kilidiyle (for_update=True) çağrılır: aynı kullanıcı için eşzamanlı iki istek
    gelirse (çift tıklama, iki sekme, ağ tekrar denemesi vs.) ikincisi birincisi
    commit/rollback edene kadar bekler, sonra kaydın artık 'success' olduğunu görüp
    gerçek ödül gönderimini tekrarlamaz.
    """
    found = _locate_entry(db, event_id, client_id, for_update=True)
    if not found:
        return {"status": "not_found", "reason": "Bu turnuva için bekleyen bir freebet/freespin ödülünüz bulunmuyor."}

    job, idx = found
    client_str = str(client_id)
    entry = job.results[client_str][idx]
    rule = entry.get("rule") or {}
    reward_type = rule.get("reward_type")
    amount = rule.get("amount")
    partner_bonus_id = rule.get("partner_bonus_id")

    eligible, reason = check_bonus_eligibility(bapi, client_id)
    if not eligible:
        # Durumu 'failed' yapmıyoruz — kullanıcı tekrar deneyebilsin (örn. bakiyesini
        # azaltıp/aktif bahsi bitirip tekrar tıklayabilir). Ama sebebi kalıcı yazıyoruz
        # ki sayfa yenilense de "neden alamadım" görünsün, sadece o anki toast'ta kalmasın.
        entry["last_check_failure"] = reason
        entry["last_checked_at"] = datetime.utcnow().isoformat()
        flag_modified(job, "results")
        db.commit()
        return {"status": "not_eligible", "reason": reason, "reward_type": reward_type, "amount": amount}

    # Kontrolü geçtiği için önceki başarısız kontrol notunu temizle.
    entry.pop("last_check_failure", None)

    if not partner_bonus_id:
        entry["status"] = "failed"
        entry["error"] = f"Missing partner_bonus_id for {reward_type}"
        entry["timestamp"] = datetime.utcnow().isoformat()
        flag_modified(job, "results")
        db.commit()
        return {"status": "failed", "reason": "Ödül tanımında partner_bonus_id eksik, admin ile iletişime geçin.", "reward_type": reward_type, "amount": amount}

    bonus_type = 5 if reward_type == "spin" else 6
    try:
        resp = bapi.add_client_to_bonus(
            client_id=client_id,
            amount=amount,
            bonus_id=partner_bonus_id,
            bonus_type=bonus_type,
            note=f"EventReward(claim):{job.event_name_snapshot or event_id}",
        )
        entry["status"] = "success"
        entry["response"] = resp
        entry.pop("error", None)
        entry["timestamp"] = datetime.utcnow().isoformat()
        result: Dict[str, Any] = {"status": "success", "reward_type": reward_type, "amount": amount}
    except Exception as e:
        logger.error(f"Claim BAPI çağrısı başarısız (client_id={client_id}, event_id={event_id}): {e}")
        entry["status"] = "failed"
        entry["error"] = str(e)  # ham hata admin panelinde ("Ödül Geçmişi") görünsün diye kaydedilir
        entry["timestamp"] = datetime.utcnow().isoformat()
        result = {"status": "failed", "reason": "Ödül gönderilirken bir sorun oluştu, lütfen daha sonra tekrar deneyin.", "reward_type": reward_type, "amount": amount}

    flag_modified(job, "results")
    db.commit()
    return result
