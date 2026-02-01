from fastapi import APIRouter, Depends, HTTPException, Request, Query
from datetime import datetime
from sqlalchemy.orm import Session
from typing import Optional
from shared.core.limiter import limiter
from shared.services.bapi import has_single_deposit, fetch_client_id_by_login
from backend_api.app.deps import get_db
from shared.models.participant import Participant
from shared.models.event import Event
from shared.models.enrollment import EventParticipant

router = APIRouter(prefix="/api")


@router.get("/leaderboard")
@limiter.limit("20/minute")
async def get_leaderboard(
    request: Request,
    event_id: Optional[int] = None,
    slug: Optional[str] = None,
    viewer_username: Optional[str] = Query(None), # For masking logic
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Belirtilen turnuva için puan tablosunu getirir (Top 50).
    Login gerektirmez.
    """
    from shared.domain.leaderboard import get_event_leaderboard
    # Logic to find event is already inside some services, but for basic listing:
    from shared.models.event import Event
    target_event = None
    if slug:
        target_event = db.query(Event).filter(Event.slug == slug).first()
    elif event_id:
        target_event = db.query(Event).filter(Event.id == event_id).first()
    else:
        target_event = db.query(Event).filter(Event.status == "active").first()
    
    if not target_event:

        raise HTTPException(status_code=404, detail="Turnuva bulunamadı")
        


    results = get_event_leaderboard(db, target_event.id)
    
    def mask_username(u: str, viewer: Optional[str]) -> str:
        if viewer and u == viewer:
            return u
        if len(u) <= 2:
            return u[0] + "***"
        return u[:2] + "***"

    # Map to rank format for public UI
    return [{
        "rank": i + 1,
        "username": mask_username(r["username"], viewer_username),
        "score": r["points"]
    } for i, r in enumerate(results[:limit])]


@router.get("/my-coupons")
async def get_my_coupons(
    username: str,
    event_id: Optional[int] = None,
    slug: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Kullanıcının kuponlarını getirir."""
    from shared.domain.participation import check_user_enrollment
    from shared.domain.participants import get_user_coupon_history
    from shared.services.bapi import fetch_client_id_by_login
    
    # Optimization: Check DB first for client_id same as used in check_user_enrollment
    from shared.models.participant import Participant
    existing_p = db.query(Participant).filter(Participant.username == username).first()
    if existing_p:
            client_id = existing_p.client_id
    else:
            client_id = await fetch_client_id_by_login(username)

    if not client_id:
        return []
        
    # Get current active event if not specified
    target_event_id = event_id
    if not event_id and not slug:
        from shared.models.event import Event
        ev = db.query(Event).filter(Event.status == "active").first()
        target_event_id = ev.id if ev else None

    if not target_event_id and slug:
            from shared.models.event import Event
            ev = db.query(Event).filter(Event.slug == slug).first()
            target_event_id = ev.id if ev else None
    
    if not target_event_id:
        return []

    total, coupons = get_user_coupon_history(db, client_id, target_event_id)
    # Filter for Won/Lost if needed as per previous logic
    return [c for c in coupons if c.state.lower() in ["won", "lost"]]


@router.get("/has-joined")
async def has_joined_api(
    username: Optional[str] = None,
    client_id: Optional[int] = None,
    event_id: Optional[int] = None,
    slug: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Katılım kontrolü."""
    from shared.domain.participation import check_user_enrollment
    return await check_user_enrollment(db, username, client_id, event_id, slug)


@router.post("/join")
@limiter.limit("5/minute")
async def join_tournament_api(
    request: Request,
    username: Optional[str] = None,
    client_id: Optional[int] = None,
    event_id: Optional[int] = None,
    slug: Optional[str] = None,
    db: Session = Depends(get_db)
):

    """Turnuvaya katıl."""
    from shared.domain.participation import join_event
    return await join_event(db, username, client_id, event_id, slug)

@router.get("/my-enrollments")
async def get_my_enrollments(
    username: str,
    db: Session = Depends(get_db)
):
    """
    Kullanıcının katıldığı turnuvaları ve bu turnuvalardaki sıralamasını getirir.
    """
    from sqlalchemy import func, desc
    from shared.models.participant import Participant
    
    # Check participant exists
    participant = db.query(Participant).filter(Participant.username == username).first()
    if not participant:
        return []

    # Calculate rank for each event participant using a window function logic
    # Since SQLAlchemy + generic DB might complicate window functions syntax across dialects, 
    # and we want it simple, we can use a subquery or python-side processing if N is small.
    # But for correctness, let's try a native query methodology or simpler approach:
    # Fetch all participants for events user is in, calculate rank? No, too heavy.
    
    # Better: Use a raw SQL or complex ORM query for Rank.
    # rank() over (partition by event_id order by total_points desc)
    
    # PostgreSQL/SQLite compatible window function:
    # We need the user's rank in EACH event they joined.
    
    # 1. Get List of EventIDs user joined.
    user_event_ids = [ep.event_id for ep in db.query(EventParticipant.event_id).filter(EventParticipant.participant_id == participant.id).all()]
    
    if not user_event_ids:
        return []
        
    # 2. For each event, finding rank efficiently 
    # If we don't have a materialized rank, we count how many have > points
    
    results = []
    from shared.models.event import Event
    
    for eid in user_event_ids:
        event = db.query(Event).get(eid)
        if not event: continue
        
        # Get user stats
        my_stats = db.query(EventParticipant).filter(
            EventParticipant.participant_id == participant.id,
            EventParticipant.event_id == eid
        ).first()
        
        if not my_stats: continue
        
        # Count rank: count(p) where points > my_points + 1
        # Handling ties: same points = share rank? usually yes.
        # rank = 1 + count(participants with points > my_points)
        rank = db.query(EventParticipant).filter(
            EventParticipant.event_id == eid,
            EventParticipant.total_points > my_stats.total_points
        ).count() + 1
        
        results.append({
            "event_id": event.id,
            "event_name": event.name,
            "status": event.status,
            "score": my_stats.total_points,
            "rank": rank,
            "slug": event.slug
        })
        
    return results
