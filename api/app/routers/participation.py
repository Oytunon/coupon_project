from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Participant

router = APIRouter()



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class JoinRequest(BaseModel):
    username: str


@router.get("/has-joined")
def has_joined(username: str, db: Session = Depends(get_db)):
    user = db.query(Participant).filter(
        Participant.username == username
    ).first()

    return {
        "username": username,
        "can_join": user is None
    }


@router.post("/join")
def join_campaign(payload: JoinRequest, db: Session = Depends(get_db)):
    username = payload.username

    existing = db.query(Participant).filter(
        Participant.username == username
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="User already joined"
        )

    participant = Participant(username=username)
    db.add(participant)
    db.commit()
    db.refresh(participant)

    return {
        "username": username,
        "joined": True
    }
