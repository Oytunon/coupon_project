from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional, Dict, Any
from datetime import datetime

from shared.database import get_db_session
from shared.models.coupon import Coupon
from shared.models.participant import Participant
from shared.models.enrollment import EventParticipant
from shared.models.event import Event

router = APIRouter(prefix="/api", tags=["user-stats"])

@router.get("/events/{event_identifier}/user/{username}")
async def get_user_event_stats(
    event_identifier: str,
    username: str,
    db: Session = Depends(get_db_session)
):
    """
    Get user statistics for a specific event (by ID or Slug).
    """
    # 1. Validate Event
    if event_identifier.isdigit():
        event = db.query(Event).filter(Event.id == int(event_identifier)).first()
    else:
        event = db.query(Event).filter(Event.slug == event_identifier).first()
        
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # 2. Get Participant
    participant = db.query(Participant).filter(Participant.username == username).first()
    
    # Defaults for non-participants
    total_points = 0.0
    rank = 0
    coupons = []
    is_enrolled = False
    coupon_list = []

    total_participants = db.query(EventParticipant).filter(
        EventParticipant.event_id == event.id
    ).count()

    if participant:
        # 3. Get Enrollment (Stats)
        enrollment = db.query(EventParticipant).filter(
            EventParticipant.event_id == event.id,
            EventParticipant.participant_id == participant.id
        ).first()

        if enrollment:
            is_enrolled = True
            
            # Use CouponEventResult for live, accurate points (matches leaderboard)
            from shared.models.coupon_event_result import CouponEventResult
            total_points = db.query(func.coalesce(func.sum(CouponEventResult.points_earned), 0.0)).join(
                Coupon, Coupon.id == CouponEventResult.coupon_id
            ).filter(
                Coupon.client_id == participant.client_id,
                CouponEventResult.event_id == event.id,
                CouponEventResult.is_eligible == True
            ).scalar()
            
            # Calculate rank live based on unique client scores for this event
            higher_rank_count = db.query(func.count()).select_from(
                db.query(Coupon.client_id)
                .join(CouponEventResult, CouponEventResult.coupon_id == Coupon.id)
                .filter(
                    CouponEventResult.event_id == event.id,
                    CouponEventResult.is_eligible == True
                )
                .group_by(Coupon.client_id)
                .having(func.sum(CouponEventResult.points_earned) > total_points)
                .subquery()
            ).scalar()
            
            rank = (higher_rank_count or 0) + 1
            
            # 5. Get Coupons with Event-Specific Results (Matches Leaderboard logic)
            results = db.query(Coupon, CouponEventResult).join(
                CouponEventResult, CouponEventResult.coupon_id == Coupon.id
            ).filter(
                CouponEventResult.event_id == event.id,
                Coupon.client_id == participant.client_id
            ).order_by(Coupon.created_at.desc()).all()

            for c, cer in results:
                coupon_data = {
                    "bet_id": c.bet_id,
                    "created_at": c.created_at,
                    "points": cer.points_earned, # Use live points from the result table
                    "state": cer.coupon_state or c.state, # Use event-specific state
                    "is_processed": c.is_processed,
                    "matches": []
                }
                
                # Parse bet_data for matches if available
                if c.bet_data:
                    try:
                        coupon_data["raw_bet_data"] = c.bet_data
                    except Exception as e:
                        coupon_data["error_parsing_bet_data"] = str(e)
                
                coupon_list.append(coupon_data)

    return {
        "username": username,
        "event_id": event.id,
        "event_slug": event.slug,
        "event_name": event.name,
        "total_points": total_points,
        "rank": rank if is_enrolled else 0,
        "total_participants": total_participants,
        "coupons": coupon_list,
        "is_enrolled": is_enrolled
    }

@router.get("/events/{event_identifier}/leaderboard")
async def get_event_leaderboard_paginated(
    event_identifier: str,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db_session)
):
    """
    Get paginated leaderboard for an event (by ID or Slug).
    """
    if event_identifier.isdigit():
        event = db.query(Event).filter(Event.id == int(event_identifier)).first()
    else:
        event = db.query(Event).filter(Event.slug == event_identifier).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    offset = (page - 1) * limit

    # Query EventParticipant joined with Participant
    results = db.query(
        Participant.username,
        EventParticipant.total_points
    ).join(
        Participant, EventParticipant.participant_id == Participant.id
    ).filter(
        EventParticipant.event_id == event.id
    ).order_by(
        EventParticipant.total_points.desc()
    ).offset(offset).limit(limit).all()

    from shared.utils.masking import mask_username

    formatted_results = [
        {
            "rank": offset + i + 1,
            "username": mask_username(row.username), 
            "points": row.total_points
        }
        for i, row in enumerate(results)
    ]

    total_count = db.query(EventParticipant).filter(
        EventParticipant.event_id == event.id
    ).count()

    return {
        "event_id": event.id,
        "event_name": event.name,
        "page": page,
        "limit": limit,
        "total": total_count,
        "leaderboard": formatted_results
    }
