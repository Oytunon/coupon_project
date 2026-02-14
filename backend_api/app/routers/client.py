from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from shared.database import get_db_session
from shared.models.event import Event
from shared.models.enrollment import EventParticipant
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
    participant_count: int
    image_url: Optional[str] = None # Placeholder for future use
    rules: dict = {}

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

    results = []
    for event in events:
        p_count = db.query(func.count(EventParticipant.id)).filter(
            EventParticipant.event_id == event.id
        ).scalar()

        results.append(PublicEventResponse(
            id=event.id,
            name=event.name,
            description=event.description,
            status=event.status,
            start_date=event.start_date,
            end_date=event.end_date,
            participant_count=p_count or 0,
            image_url=event.image_url,
            rules=event.rules or {}
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
                if r.get("status") != "success":
                    continue

                rule = r.get("rule", {})
                if not isinstance(rule, dict):
                    continue

                winners.append({
                    "username": username,
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
