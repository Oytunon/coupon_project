from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from shared.models.participant import Participant
from shared.models.coupon import Coupon
from shared.models.event import Event
from shared.models.enrollment import EventParticipant

def list_participants_paginated(
    db: Session, 
    event_id: Optional[int] = None, 
    skip: int = 0, 
    limit: int = 20, 
    search: Optional[str] = None
):
    query = db.query(Participant)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(Participant.username.ilike(search_term))
        
    total = query.count()
    participants = query.offset(skip).limit(limit).all()
    
    from shared.models.coupon_event_result import CouponEventResult
    
    items = []
    for p in participants:
        # Calculate stats correctly for the specific event
        if event_id:
             # Count coupons for this event via Intersection table
             coupon_count = db.query(func.count(CouponEventResult.id)).filter(
                 CouponEventResult.event_id == event_id,
                 CouponEventResult.coupon_id.in_(
                     db.query(Coupon.id).filter(Coupon.client_id == p.client_id)
                 ),
                 CouponEventResult.is_eligible == True
             ).scalar()
             
             # Get points directly from CouponEventResult aggregation (Live consistency)
             # This ensures Admin Panel matches Client/Leaderboard exactly.
             total_points = db.query(func.coalesce(func.sum(CouponEventResult.points_earned), 0.0)).filter(
                 CouponEventResult.event_id == event_id,
                 CouponEventResult.coupon_id.in_(
                     db.query(Coupon.id).filter(Coupon.client_id == p.client_id)
                 ),
                 CouponEventResult.is_eligible == True
             ).scalar()
             
        else:
            # Fallback for Global View (Sum of points from all enrolled events)
            total_points = db.query(func.sum(EventParticipant.total_points)).filter(
                EventParticipant.participant_id == p.id
            ).scalar() or 0.0
            
            # For coupon count, we still count master coupons
            coupon_count = db.query(Coupon).filter(Coupon.client_id == p.client_id).count()
        
        enrolled_events = db.query(Event).join(EventParticipant).filter(EventParticipant.participant_id == p.id).all()
        enrolled_event_names = [e.name for e in enrolled_events]

        items.append({
            "id": p.id,
            "client_id": p.client_id,
            "username": p.username,
            "joined_at": p.joined_at,
            "coupon_count": coupon_count,
            "points": total_points,
            "enrolled_events": enrolled_event_names
        })
        
    return total, items

def get_user_coupon_history(
    db: Session, 
    client_id: int, 
    event_id: Optional[int] = None, 
    skip: int = 0, 
    limit: int = 20
):
    from shared.models.coupon_event_result import CouponEventResult
    
    query = db.query(Coupon).filter(Coupon.client_id == client_id)
    if event_id:
        # Multi-Event Support: Filter by presence in CouponEventResult, not Master Coupon event_id
        query = query.join(CouponEventResult, CouponEventResult.coupon_id == Coupon.id)\
                     .filter(CouponEventResult.event_id == event_id)
        
    total = query.count()
    coupons = query.order_by(Coupon.inserted_at.desc()).offset(skip).limit(limit).all()
    
    # Post-processing: Inject specific event points into 'calculation' field for display
    if event_id and coupons:
        coupon_ids = [c.id for c in coupons]
        results = db.query(CouponEventResult).filter(
            CouponEventResult.event_id == event_id,
            CouponEventResult.coupon_id.in_(coupon_ids)
        ).all()
        result_map = {r.coupon_id: r.points_earned for r in results}
        
        for c in coupons:
            if c.id in result_map:
                c.calculation = result_map[c.id]

    return total, coupons
