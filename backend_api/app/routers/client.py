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
            image_url=None,
            rules=event.rules or {}
        ))

    # Python-side sorting: Active(1) > Paused(2) > Ended(3) > Other(4)
    status_priority = {"active": 1, "paused": 2, "ended": 3}
    results.sort(key=lambda x: status_priority.get(x.status, 4))
    
    return results
