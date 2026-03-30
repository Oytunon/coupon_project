from sqlalchemy.orm import Session
from sqlalchemy import func
from shared.models.event import Event
from shared.models.coupon_event_result import CouponEventResult
from shared.models.coupon import Coupon
from shared.models.enrollment import EventParticipant

def get_event_metrics(db: Session, event_id: int):
    # Aggregates from CouponEventResult
    res_total = db.query(func.count(CouponEventResult.id))\
        .filter(CouponEventResult.event_id == event_id).scalar() or 0
    res_eligible = db.query(func.count(CouponEventResult.id))\
        .filter(CouponEventResult.event_id == event_id, CouponEventResult.is_eligible == True).scalar() or 0
    res_points = db.query(func.sum(CouponEventResult.points_earned))\
        .filter(CouponEventResult.event_id == event_id).scalar() or 0.0

    # Aggregates from Coupon
    c_total = db.query(func.count(Coupon.id)).filter(Coupon.event_id == event_id).scalar() or 0
    c_won = db.query(func.count(Coupon.id)).filter(Coupon.event_id == event_id, func.lower(Coupon.state) == "won").scalar() or 0
    c_lost = db.query(func.count(Coupon.id)).filter(Coupon.event_id == event_id, func.lower(Coupon.state) == "lost").scalar() or 0
    c_stake = db.query(func.sum(Coupon.stake)).filter(Coupon.event_id == event_id).scalar() or 0.0
    
    # Participants
    participants_count = db.query(func.count(func.distinct(EventParticipant.participant_id)))\
        .filter(EventParticipant.event_id == event_id).order_by(None).scalar() or 0

    avg_stake = c_stake / c_total if c_total > 0 else 0.0
    
    return {
        "total_participants": participants_count,
        "total_coupons": c_total,
        "eligible_coupons": res_eligible,
        "won_coupons": c_won,
        "lost_coupons": c_lost,
        "pending_coupons": c_total - (c_won + c_lost),
        "total_stake": c_stake,
        "total_points_distributed": res_points,
        "avg_points_per_user": res_points / participants_count if participants_count > 0 else 0.0,
        "avg_stake": round(avg_stake, 2)
    }
