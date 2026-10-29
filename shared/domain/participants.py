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
    
    if event_id:
        query = query.join(EventParticipant).filter(EventParticipant.event_id == event_id)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(Participant.username.ilike(search_term))
        
    total = query.count()
    participants = query.offset(skip).limit(limit).all()
    if not participants:
        return total, []

    from shared.models.coupon_event_result import CouponEventResult

    # Sayfadaki tüm katılımcılar için toplu sorgular (eskiden kişi başı 3-4 sorgu, sayfa başı ~60-80)
    participant_ids = [p.id for p in participants]
    client_ids = [p.client_id for p in participants]

    if event_id:
        # Count coupons for this event via Intersection table; points directly from CouponEventResult
        # aggregation (Live consistency) so Admin Panel matches Client/Leaderboard exactly.
        event_rows = db.query(
            Coupon.client_id,
            func.count(CouponEventResult.id),
            func.coalesce(func.sum(CouponEventResult.points_earned), 0.0)
        ).join(CouponEventResult, CouponEventResult.coupon_id == Coupon.id).filter(
            CouponEventResult.event_id == event_id,
            CouponEventResult.is_eligible == True,
            Coupon.client_id.in_(client_ids)
        ).group_by(Coupon.client_id).all()
        event_stats = {client_id: (count, points) for client_id, count, points in event_rows}
    else:
        # Fallback for Global View (Sum of points from all enrolled events)
        points_rows = db.query(EventParticipant.participant_id, func.sum(EventParticipant.total_points)).filter(
            EventParticipant.participant_id.in_(participant_ids)
        ).group_by(EventParticipant.participant_id).all()
        global_points = dict(points_rows)

        # For coupon count, we still count master coupons
        count_rows = db.query(Coupon.client_id, func.count(Coupon.id)).filter(
            Coupon.client_id.in_(client_ids)
        ).group_by(Coupon.client_id).all()
        global_counts = dict(count_rows)

    enrolled_rows = db.query(EventParticipant.participant_id, Event.name).join(
        Event, Event.id == EventParticipant.event_id
    ).filter(EventParticipant.participant_id.in_(participant_ids)).all()
    enrolled_names: dict = {}
    for participant_id, name in enrolled_rows:
        enrolled_names.setdefault(participant_id, []).append(name)

    items = []
    for p in participants:
        if event_id:
            coupon_count, total_points = event_stats.get(p.client_id, (0, 0.0))
        else:
            total_points = global_points.get(p.id) or 0.0
            coupon_count = global_counts.get(p.client_id, 0)

        items.append({
            "id": p.id,
            "client_id": p.client_id,
            "username": p.username,
            "joined_at": p.joined_at,
            "coupon_count": coupon_count,
            "points": total_points,
            "enrolled_events": enrolled_names.get(p.id, [])
        })

    return total, items

def get_user_coupon_history(
    db: Session, 
    client_id: int, 
    event_id: Optional[int] = None, 
    skip: int = 0, 
    limit: int = 20,
    search: Optional[str] = None
):
    from shared.models.coupon_event_result import CouponEventResult
    
    query = db.query(Coupon).filter(Coupon.client_id == client_id)
    if event_id:
        # Multi-Event Support: Filter by presence in CouponEventResult, not Master Coupon event_id
        query = query.join(CouponEventResult, CouponEventResult.coupon_id == Coupon.id)\
                     .filter(CouponEventResult.event_id == event_id)
    
    if search:
        query = query.filter(Coupon.bet_id.ilike(f"%{search}%"))
        
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
