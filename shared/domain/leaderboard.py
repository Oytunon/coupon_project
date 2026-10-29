import threading
import time
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from shared.models.participant import Participant
from shared.models.enrollment import EventParticipant
from shared.models.coupon_event_result import CouponEventResult
from shared.models.coupon import Coupon


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
_REFRESH_MARGIN = timedelta(minutes=3)
_ENDED_TTL_SECONDS = 3600    # bitmiş turnuvada sıralama değişmez (admin işlemleri önbelleği siler)
_leaderboard_cache: dict = {}
# Önbellek dolduğunda aynı anda yüzlerce üye gelse de ağır sorguyu turnuva başına tek istek çalıştırsın
_refresh_locks: dict = {}
_refresh_locks_guard = threading.Lock()


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
    from shared.models.event import Event

    # Çağıran listeyi değiştirse bile önbellek bozulmasın
    def copy(rows):
        return [dict(r) for r in rows]

    cached = _leaderboard_cache.get(event_id)
    if cached and time.monotonic() < cached[0]:
        return copy(cached[1])

    # Başka bir istek yeniliyorsa o bitene kadar bir önceki sıralamayı göster;
    # hiç sonuç yoksa (ilk dolum / admin sildi) hesaplanmasını bekle
    lock = _refresh_lock(event_id)
    if not lock.acquire(blocking=cached is None):
        return copy(cached[1])
    try:
        cached = _leaderboard_cache.get(event_id)
        if cached and time.monotonic() < cached[0]:  # beklerken başka istek yeniledi
            return copy(cached[1])
        rows = get_event_leaderboard(db, event_id)
        status = db.query(Event.status).filter(Event.id == event_id).scalar()
        ttl = _ENDED_TTL_SECONDS if status in ("ended", "archived") else _seconds_until_next_refresh(datetime.now())
        _leaderboard_cache[event_id] = (time.monotonic() + ttl, rows)
        return copy(rows)
    finally:
        lock.release()


def invalidate_event_leaderboard_cache(event_id: int):
    """Puanları değiştiren admin işlemlerinden (yeniden hesapla, manuel kupon) sonra çağrılır."""
    _leaderboard_cache.pop(event_id, None)
