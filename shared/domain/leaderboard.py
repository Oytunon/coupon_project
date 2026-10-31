import logging
import random
import threading
import time
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from shared.models.participant import Participant
from shared.models.enrollment import EventParticipant
from shared.models.coupon_event_result import CouponEventResult
from shared.models.coupon import Coupon

logger = logging.getLogger(__name__)


def get_event_leaderboard(db: Session, event_id: int):
    """
    Tek sorgu ile leaderboard getirir (N+1 problemi giderildi).
    """
    points_expr = func.coalesce(
        func.sum(case((CouponEventResult.is_eligible == True, CouponEventResult.points_earned), else_=0.0)),
        0.0
    )
    rows = (
        db.query(
            Participant.id,
            Participant.username,
            Participant.client_id,
            Participant.joined_at,
            points_expr.label("points"),
            func.count(CouponEventResult.coupon_id).label("coupon_count"),
        )
        .select_from(EventParticipant)
        .join(Participant, EventParticipant.participant_id == Participant.id)
        .outerjoin(
            Coupon,
            (Coupon.client_id == Participant.client_id)
        )
        .outerjoin(
            CouponEventResult,
            (Coupon.id == CouponEventResult.coupon_id) & (CouponEventResult.event_id == event_id)
        )
        .filter(EventParticipant.event_id == event_id)
        .group_by(Participant.id, Participant.username, Participant.client_id, Participant.joined_at)
        .order_by(points_expr.desc())
        .all()
    )

    return [
        {
            "id": r.id,
            "username": r.username,
            "client_id": r.client_id,
            "joined_at": r.joined_at,
            "coupon_count": r.coupon_count or 0,
            "points": float(r.points) if r.points is not None else 0.0,
        }
        for r in rows
    ]


# Ekranda gösterilen sıralamalar (üye sıralama tablosu, "Katıldığım Turnuvalar", admin
# "Detayları Gör") için önbellek: büyük turnuvada sorgu 2-9 sn sürüyor ve her istekte
# tekrar hesaplanıyordu. Ödül dağıtımı ve export'lar get_event_leaderboard'ı doğrudan
# çağırır, her zaman canlı sıralamayı kullanır.
# Aktif turnuvada puanlar yalnız 15 dk'lık otomatik taramada (:00/:15/:30/:45) değişir;
# önbellek her taramadan 3 dk sonra yenilenir (tarama 10-40 sn sürüyor).
# Bitmiş turnuvada sıralama değişmez; süresi dolunca üye beklemez, eldeki gösterilip yenisi
# arka planda hesaplanır. Admin'in puan/durum işlemleri önbelleği zaten anında siler; periyodik
# yenileme yalnız worker işleri ve script'lerin (API'ye haber veremeyen) değişikliklerini yakalar.
_REFRESH_MARGIN = timedelta(minutes=3)
_ENDED_TTL_SECONDS = 3600    # worker işleri/script'ler biten turnuvada puan değiştirirse en geç 1 saatte görünür
# event_id -> (geçerlilik sonu, satırlar, bitmiş mi)
_leaderboard_cache: dict = {}
# Önbellek silindiğinde artar; silinmeden önce başlamış bir hesaplama eski sonucu yazamasın
_cache_generations: dict = {}
# Önbellek dolduğunda aynı anda yüzlerce üye gelse de ağır sorguyu turnuva başına tek istek çalıştırsın
_refresh_locks: dict = {}
_refresh_locks_guard = threading.Lock()
# Arka plan yenilemeleri aynı anda en fazla 2 DB bağlantısı kullansın (üyelerin isteklerine bağlantı kalsın)
_background_refresh_slots = threading.Semaphore(2)


def _refresh_lock(event_id: int) -> threading.Lock:
    with _refresh_locks_guard:
        return _refresh_locks.setdefault(event_id, threading.Lock())


def _seconds_until_next_refresh(now: datetime) -> float:
    quarter = now.replace(minute=now.minute - now.minute % 15, second=0, microsecond=0)
    refresh_at = quarter + _REFRESH_MARGIN
    if now >= refresh_at:
        refresh_at += timedelta(minutes=15)
    return (refresh_at - now).total_seconds()


def get_event_leaderboard_cached(db: Session, event_id: int):
    """get_event_leaderboard ile aynı sonuç ve sıra; en son otomatik taramanın sonucunu gösterir."""

    # Çağıran listeyi değiştirse bile önbellek bozulmasın
    def copy(rows):
        return [dict(r) for r in rows]

    cached = _leaderboard_cache.get(event_id)
    if cached and time.monotonic() < cached[0]:
        return copy(cached[1])

    lock = _refresh_lock(event_id)

    # Bitmiş turnuva: süresi dolan sıralamayı beklemeden göster, yenisini arka planda hesapla
    if cached and cached[2]:
        if lock.acquire(blocking=False):
            _start_background_refresh(event_id, lock)
        return copy(cached[1])

    # Başka bir istek yeniliyorsa o bitene kadar bir önceki sıralamayı göster;
    # hiç sonuç yoksa (ilk dolum / admin sildi) hesaplanmasını bekle
    if not lock.acquire(blocking=cached is None):
        return copy(cached[1])
    try:
        cached = _leaderboard_cache.get(event_id)
        if cached and time.monotonic() < cached[0]:  # beklerken başka istek yeniledi
            return copy(cached[1])
        return copy(_refresh(db, event_id))
    finally:
        lock.release()


def _refresh(db: Session, event_id: int):
    """Sıralamayı hesaplar ve önbelleğe yazar; çağıran turnuvanın kilidini tutuyor olmalı."""
    from shared.models.event import Event

    generation = _cache_generations.get(event_id, 0)
    rows = get_event_leaderboard(db, event_id)
    status = db.query(Event.status).filter(Event.id == event_id).scalar()
    ended = status in ("ended", "archived")
    if ended:
        # Birlikte hesaplananların (ör. API açılışı) süresi de birlikte dolmasın, yenilemeler zamana yayılsın
        ttl = _ENDED_TTL_SECONDS * random.uniform(0.9, 1.1)
    else:
        ttl = _seconds_until_next_refresh(datetime.now())
    # Hesaplama sürerken admin önbelleği sildiyse bu sonuç eskimiş olabilir; yazma, sıradaki istek yeniden hesaplasın
    if _cache_generations.get(event_id, 0) == generation:
        _leaderboard_cache[event_id] = (time.monotonic() + ttl, rows, ended)
    return rows


def _start_background_refresh(event_id: int, lock: threading.Lock):
    """Kilit alınmış olarak çağrılır; kilit arka plandaki hesaplama bitince bırakılır."""
    def run():
        from shared.database import SessionLocal
        try:
            with _background_refresh_slots:  # bağlantı ancak sıra gelince açılır
                db = SessionLocal()
                try:
                    _refresh(db, event_id)
                finally:
                    db.close()
        except Exception as e:
            # Eski sıralama gösterilmeye devam eder; sıradaki istek tekrar dener
            logger.warning(f"Sıralama arka planda yenilenemedi (event_id={event_id}): {e}")
        finally:
            lock.release()

    try:
        threading.Thread(target=run, daemon=True, name=f"leaderboard-refresh-{event_id}").start()
    except Exception as e:
        lock.release()
        logger.warning(f"Sıralama yenileme başlatılamadı (event_id={event_id}): {e}")


def warm_leaderboard_cache():
    """API açılınca sıralamaları arka planda önceden hesaplar; deploy sonrası ilk gelen üye beklemesin."""
    from shared.database import SessionLocal
    from shared.models.event import Event

    db = SessionLocal()
    try:
        event_ids = [
            eid for (eid,) in db.query(Event.id)
            .filter(Event.status.in_(["active", "paused", "ended", "archived"]))
            .order_by(case((Event.status == "active", 0), else_=1), Event.end_date.desc())
            .all()
        ]
        db.rollback()
        started = time.monotonic()
        for event_id in event_ids:
            try:
                get_event_leaderboard_cached(db, event_id)
            except Exception as e:
                logger.warning(f"Sıralama önceden hesaplanamadı (event_id={event_id}): {e}")
            finally:
                db.rollback()  # okuma işlemini kapat, bağlantı turnuvalar arasında açık kalmasın
        logger.info(f"Sıralama önbelleği dolduruldu: {len(event_ids)} turnuva, {time.monotonic() - started:.1f} sn")
    except Exception as e:
        logger.warning(f"Sıralama önbelleği doldurulamadı: {e}")
    finally:
        db.close()


def invalidate_event_leaderboard_cache(event_id: int):
    """Puanları veya durumu değiştiren admin işlemlerinden (yeniden hesapla, manuel kupon, durum) sonra çağrılır."""
    _cache_generations[event_id] = _cache_generations.get(event_id, 0) + 1
    _leaderboard_cache.pop(event_id, None)
