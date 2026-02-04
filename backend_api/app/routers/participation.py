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
    
    from shared.models.participant import Participant
    existing_p = db.query(Participant).filter(Participant.username == username).first()
    if existing_p:
            client_id = existing_p.client_id
    else:
            client_id = await fetch_client_id_by_login(username)

    if not client_id:
        return []
        
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

    # Limit increased to 1000 to show 'all' coupons for the event as requested
    total, coupons = get_user_coupon_history(db, client_id, target_event_id, limit=1000)
    
    # Properly serialize coupon objects including bet_data
    result = []
    for c in coupons:
        if c.state and c.state.lower() in ["won", "lost"]:
            result.append({
                "id": c.id,
                "bet_id": c.bet_id,
                "client_id": c.client_id,
                "event_id": c.event_id,
                "stake": c.stake,
                "odds": c.odds,
                "state": c.state,
                "winning": c.winning,
                "calculation": c.calculation,
                "is_live": c.is_live,
                "inserted_at": c.inserted_at.isoformat() if c.inserted_at else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "bet_data": c.bet_data  # JSONB field - properly included
            })
    return result


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
    participant = db.query(Participant).filter(Participant.username == username).first()
    if not participant:
        return []

    user_event_ids = [ep.event_id for ep in db.query(EventParticipant.event_id).filter(EventParticipant.participant_id == participant.id).all()]
    
    if not user_event_ids:
        return []
        
    
    results = []
    from shared.models.event import Event
    
    for eid in user_event_ids:
        event = db.query(Event).get(eid)
        if not event: continue
        
        # Cache yerine canlı hesaplama yap (Leaderboard ile tutarlı olması için)
        # Leaderboard mantığı: shared/domain/leaderboard.py -> get_event_leaderboard
        from shared.models.coupon import Coupon
        live_score = db.query(func.coalesce(func.sum(Coupon.calculation), 0.0)).filter(
            Coupon.client_id == participant.client_id, 
            Coupon.event_id == eid
        ).scalar()
        
        # Rank için cache kullanmaya devam ediyoruz (Performans için)
        # Not: Eğer cache güncel değilse rank hatalı olabilir ancak score doğrusunu gösterecek.
        # Rank Calculation (Live Consistency Fix)
        # We must count how many people have a higher score than me based on ACTUAL Coupon data
        # NOT the cached EventParticipant table which might be lagging/empty for old data.
        
        # Subquery: Calculate total score for each participant in this event
        higher_rank_count = db.query(func.count()).select_from(
            db.query(Coupon.client_id, func.sum(Coupon.calculation).label('total_score'))
            .filter(Coupon.event_id == eid)
            .group_by(Coupon.client_id)
            .having(func.sum(Coupon.calculation) > (live_score or 0))
            .subquery()
        ).scalar()

        rank = (higher_rank_count or 0) + 1
        
        results.append({
            "event_id": event.id,
            "event_name": event.name,
            "status": event.status,
            "score": live_score, # my_stats.total_points yerine live_score
            "rank": rank,
            "slug": event.slug
        })
        
    return results
