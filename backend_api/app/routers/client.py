from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from shared.database import get_db_session
from shared.models.event import Event
from shared.models.enrollment import EventParticipant
from shared.core.limiter import limiter
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/client", tags=["client"])

class PublicEventResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: str
    start_date: datetime
    end_date: datetime
    display_until: Optional[datetime] = None
    participant_count: int
    image_url: Optional[str] = None # Placeholder for future use
    rules: dict = {}
    content_rules: List[dict] = []
    content_rules_html: Optional[str] = None

    class Config:
        from_attributes = True

@router.get("/events", response_model=List[PublicEventResponse])
async def get_public_events(
    db: Session = Depends(get_db_session)
):
    """
    Public endpoint to list all events for the Lobby.
    """
    
    events = db.query(Event).filter(
        Event.status.in_(["active", "ended", "paused"])
    ).order_by(
        Event.end_date.desc()
    ).all()

    now = datetime.now()
    results = []
    for event in events:
        # Ended events with expired display_until should be hidden
        if event.status == "ended" and event.display_until and now > event.display_until:
            continue

        p_count = db.query(func.count(EventParticipant.id)).filter(
            EventParticipant.event_id == event.id
        ).scalar()

        rules_for_client = dict(event.rules or {})
        rules_for_client.pop("yan_bahis_ids", None)
        results.append(PublicEventResponse(
            id=event.id,
            name=event.name,
            description=event.description,
            status=event.status,
            start_date=event.start_date,
            end_date=event.end_date,
            display_until=event.display_until,
            participant_count=p_count or 0,
            image_url=event.image_url,
            rules=rules_for_client,
            content_rules=event.content_rules or [],
            content_rules_html=event.content_rules_html
        ))

    # Python-side sorting: Active(1) > Paused(2) > Ended(3) > Other(4)
    status_priority = {"active": 1, "paused": 2, "ended": 3}
    results.sort(key=lambda x: status_priority.get(x.status, 4))
    
    return results
@router.get("/my-rewards")
async def get_my_rewards(
    username: str,
    db: Session = Depends(get_db_session)
):
    from shared.models.reward_job import RewardJob
    from shared.models.participant import Participant
    
    participant = db.query(Participant).filter(Participant.username == username).first()
    if not participant:
        return []
    
    client_id_str = str(participant.client_id)
    
    # Optimization: Filter jobs that actually have results (status=completed or processing)
    jobs = db.query(RewardJob).filter(RewardJob.status.in_(["completed", "processing"])).order_by(RewardJob.created_at.desc()).all()
    
    my_rewards = []
    for job in jobs:
        results = job.results or {}
        if client_id_str in results:
            for r in results[client_id_str]:
                if r.get("status") == "success":
                    my_rewards.append({
                        "id": f"{job.id}_{r.get('timestamp')}",
                        "event_id": job.event_id,
                        "event_name": job.event_name_snapshot or "Etkinlik",
                        "reward_type": r.get("rule", {}).get("reward_type"),
                        "amount": r.get("rule", {}).get("amount"),
                        "timestamp": r.get("timestamp")
                    })
    
    return my_rewards


@router.get("/events/{event_id}/reward-winners")
async def get_event_reward_winners(
    event_id: int,
    db: Session = Depends(get_db_session)
):
    """
    Belirli bir turnuvada ödül kazanan kullanıcıları döndürür.
    Sadece completed RewardJob'lardan başarılı ödülleri listeler.
    """
    from shared.models.reward_job import RewardJob
    from shared.models.participant import Participant
    from shared.utils.masking import mask_username

    jobs = db.query(RewardJob).filter(
        RewardJob.event_id == event_id,
        RewardJob.status == "completed"
    ).order_by(RewardJob.completed_at.desc()).all()

    if not jobs:
        return []

    winners = []
    seen_client_ids = set()

    for job in jobs:
        results = job.results or {}
        if not isinstance(results, dict):
            continue

        for client_id_str, rewards_list in results.items():
            if not isinstance(rewards_list, list):
                continue

            # Skip duplicates across jobs
            if client_id_str in seen_client_ids:
                continue
            seen_client_ids.add(client_id_str)

            # Resolve username
            try:
                c_id = int(client_id_str)
                username = db.query(Participant.username).filter(
                    Participant.client_id == c_id
                ).scalar() or f"User-{client_id_str}"
            except (ValueError, TypeError):
                username = f"User-{client_id_str}"

            for r in rewards_list:
                if not isinstance(r, dict):
                    continue
                # 'success' (nakit/onaylı) yanında 'pending_claim' ve 'failed' (freebet/spin,
                # kullanıcı henüz "Ödülünü Al"a basmadı veya deneme başarısız oldu) de
                # listelenir — ödülü kazanmış olmak, henüz teslim almış olmaktan ayrı.
                if r.get("status") not in ("success", "pending_claim", "failed"):
                    continue

                rule = r.get("rule", {})
                if not isinstance(rule, dict):
                    continue

                winners.append({
                    "username": mask_username(username),
                    "client_id": client_id_str,
                    "reward_type": rule.get("reward_type", ""),
                    "amount": rule.get("amount", 0),
                    "criteria_type": rule.get("criteria_type", ""),
                    "criteria_value": rule.get("criteria_value", 0),
                })

    # Sort by criteria_value (rank first, then min_points)
    winners.sort(key=lambda w: (
        0 if w["criteria_type"] in ("rank", "rank_exact") else 1,
        w["criteria_value"]
    ))

    return winners


class ClaimRewardRequest(BaseModel):
    username: str


@router.get("/events/{event_id}/my-claimable-reward")
async def get_my_claimable_reward(
    event_id: int,
    username: str,
    db: Session = Depends(get_db_session)
):
    """
    Bu kullanıcının bu etkinlik için bekleyen (henüz claim edilmemiş) bir
    freebet/freespin ödülü var mı? Client'taki "Ödülünü Al" butonunu göstermek için.
    """
    from shared.models.participant import Participant
    from shared.domain.reward_claim import find_pending_claim

    participant = db.query(Participant).filter(Participant.username == username).first()
    if not participant:
        return {"has_claimable": False}

    info = find_pending_claim(db, event_id, participant.client_id)
    if not info:
        return {"has_claimable": False}

    return {"has_claimable": True, **info}


@router.post("/events/{event_id}/claim-reward")
@limiter.limit("5/minute")
async def claim_reward(
    request: Request,
    event_id: int,
    body: ClaimRewardRequest,
    db: Session = Depends(get_db_session)
):
    """
    Kullanıcı "Ödülünü Al" butonuna bastığında çağrılır: bonus uygunluk kontrollerini
    çalıştırır, geçerse gerçek freebet/freespin ödülünü partner API'ye gönderir.
    """
    from shared.models.participant import Participant
    from shared.domain.reward_claim import claim_pending_reward
    from backend_api.app.services.bapi_client import BapiClient
    from shared.settings import settings

    participant = db.query(Participant).filter(Participant.username == body.username).first()
    if not participant:
        return {"status": "not_found", "reason": "Kullanıcı bulunamadı."}

    bapi = BapiClient(token=settings.STATS_BAPI_TOKEN)
    return claim_pending_reward(db, bapi, event_id, participant.client_id)


@router.get("/leagues")
async def get_leagues(
    db: Session = Depends(get_db_session)
):
    """
    Public endpoint to list leagues for mapping in frontend.
    Returns ID, Name, SportID, Region.
    """
    from shared.models.league import League
    
    leagues = db.query(League).order_by(League.name).all()
    
    return [
        {
            "id": l.id,
            "name": l.name,
            "sport_id": l.sport_id,
            "region": l.region
        }
        for l in leagues
    ]
