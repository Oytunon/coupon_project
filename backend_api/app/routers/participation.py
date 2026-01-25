from fastapi import APIRouter, Depends, HTTPException, Request
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
    # Map to rank format for public UI
    return [{
        "rank": i + 1,
        "username": r["username"][:3] + "***" if r["username"] and len(r["username"]) > 3 else r["username"],
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
