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
        total_points = db.query(func.coalesce(func.sum(Coupon.calculation), 0.0))\
            .filter(Coupon.client_id == p.client_id, Coupon.event_id == event_id).scalar()
        
        coupon_count = db.query(func.count(Coupon.id))\
            .filter(Coupon.client_id == p.client_id, Coupon.event_id == event_id).scalar()
        
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
