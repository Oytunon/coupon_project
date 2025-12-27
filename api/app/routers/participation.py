from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.deps import get_db
from common.models.participant import Participant
from app.services.bapi_deposit_service import has_single_deposit_1000, fetch_client_id_by_login

router = APIRouter(prefix="/api")


@router.get("/has-joined")
async def has_joined(
    username: Optional[str] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Check if user has joined the tournament.
    Can use either username (login) or client_id.
    If username is provided, it will be converted to client_id first.
    """
    # If username provided, convert to client_id
    if username:
        resolved_client_id = await fetch_client_id_by_login(username)
        if not resolved_client_id:
            raise HTTPException(status_code=404, detail="User not found")
        client_id = resolved_client_id
    elif not client_id:
        raise HTTPException(status_code=400, detail="Either username or client_id must be provided")
    
    exists = db.query(Participant).filter_by(client_id=client_id).first()
    return {"can_join": exists is None}


@router.post("/join")
async def join_tournament(
    username: Optional[str] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Join the tournament.
    Can use either username (login) or client_id.
    If username is provided, it will be converted to client_id first.
    """
    # If username provided, convert to client_id
    resolved_username = username
    if username:
        resolved_client_id = await fetch_client_id_by_login(username)
        if not resolved_client_id:
            raise HTTPException(status_code=404, detail="User not found")
        client_id = resolved_client_id
    elif not client_id:
        raise HTTPException(status_code=400, detail="Either username or client_id must be provided")
    else:
        resolved_username = None  # client_id ile geldiyse username yok
    
    exists = db.query(Participant).filter_by(client_id=client_id).first()
    if exists:
        raise HTTPException(status_code=400, detail="User already joined")

    eligible = await has_single_deposit_1000(client_id)
    if not eligible:
        raise HTTPException(
            status_code=403,
            detail="No single deposit >= 1000 TL in current month"
        )

    # Save both username and client_id
    db.add(Participant(client_id=client_id, username=resolved_username))
    db.commit()

    return {"status": "joined"}
