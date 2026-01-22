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
    
    items = []
    for p in participants:
        coupon_query = db.query(Coupon).filter(Coupon.client_id == p.client_id)
        if event_id:
            coupon_query = coupon_query.filter(Coupon.event_id == event_id)
            
        coupons = coupon_query.all()
        coupon_count = len(coupons)
        total_points = sum(c.calculation or 0 for c in coupons)
        
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
    query = db.query(Coupon).filter(Coupon.client_id == client_id)
    if event_id:
        query = query.filter(Coupon.event_id == event_id)
        
    total = query.count()
    coupons = query.order_by(Coupon.inserted_at.desc()).offset(skip).limit(limit).all()
    
    return total, coupons
