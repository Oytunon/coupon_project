import time
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
# "Detayları Gör") için kısa süreli önbellek: büyük turnuvada sorgu 2-6 sn sürüyor ve her
# istekte tekrar hesaplanıyordu. Ödül dağıtımı ve export'lar get_event_leaderboard'ı
# doğrudan çağırır, her zaman canlı sıralamayı kullanır.
_ACTIVE_TTL_SECONDS = 60     # puanlar zaten 15 dk'da bir güncelleniyor
_ENDED_TTL_SECONDS = 600     # bitmiş turnuvada sıralama değişmez (admin işlemleri önbelleği siler)
_leaderboard_cache: dict = {}


def get_event_leaderboard_cached(db: Session, event_id: int):
    """get_event_leaderboard ile aynı sonuç ve sıra; en fazla TTL kadar eski olabilir."""
    from shared.models.event import Event

    cached = _leaderboard_cache.get(event_id)
    if cached and time.monotonic() < cached[0]:
        rows = cached[1]
    else:
        rows = get_event_leaderboard(db, event_id)
        status = db.query(Event.status).filter(Event.id == event_id).scalar()
        ttl = _ENDED_TTL_SECONDS if status in ("ended", "archived") else _ACTIVE_TTL_SECONDS
        _leaderboard_cache[event_id] = (time.monotonic() + ttl, rows)
    # Çağıran listeyi değiştirse bile önbellek bozulmasın
    return [dict(r) for r in rows]


def invalidate_event_leaderboard_cache(event_id: int):
    """Puanları değiştiren admin işlemlerinden (yeniden hesapla, manuel kupon) sonra çağrılır."""
    _leaderboard_cache.pop(event_id, None)
