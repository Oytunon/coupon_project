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
