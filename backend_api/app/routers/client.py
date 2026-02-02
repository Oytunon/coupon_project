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
        case(
           (Event.status == 'active', 1),
           (Event.status == 'paused', 2),
           (Event.status == 'ended', 3),
           else_=4
        ),
        Event.end_date.desc()
    ).all()
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

    return results
