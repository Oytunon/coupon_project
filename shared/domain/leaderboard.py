from sqlalchemy.orm import Session
from sqlalchemy import func
from shared.models.participant import Participant
from shared.models.enrollment import EventParticipant
from shared.models.coupon_event_result import CouponEventResult
from shared.models.coupon import Coupon

def get_event_leaderboard(db: Session, event_id: int):
    participants = db.query(Participant).join(EventParticipant)\
        .filter(EventParticipant.event_id == event_id).all()
        
    result = []
    for p in participants:
        # FIX: Query CouponEventResult for accurate points
        # A coupon might be associated with this event via CouponEventResult even if Coupon.event_id is different.
        from shared.models.coupon_event_result import CouponEventResult
        
        total_points = db.query(func.coalesce(func.round(func.sum(CouponEventResult.points_earned), 2), 0.0)).join(
             Coupon, Coupon.id == CouponEventResult.coupon_id
        ).filter(
            Coupon.client_id == p.client_id, 
            CouponEventResult.event_id == event_id,
            CouponEventResult.is_eligible == True
        ).scalar()
        
        coupon_count = db.query(func.count(CouponEventResult.coupon_id)).join(
             Coupon, Coupon.id == CouponEventResult.coupon_id
        ).filter(
            Coupon.client_id == p.client_id, 
            CouponEventResult.event_id == event_id
        ).scalar()
        
        result.append({
            "id": p.id,
            "username": p.username,
            "client_id": p.client_id,
            "joined_at": p.joined_at,
            "coupon_count": coupon_count,
            "points": total_points
        })
    
    result.sort(key=lambda x: x["points"], reverse=True)
    return result
