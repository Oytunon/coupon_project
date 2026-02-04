from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from backend_api.app.deps import get_db, verify_api_token
from shared.models.league import League
from pydantic import BaseModel

router = APIRouter(prefix="/api/leagues", tags=["leagues"], dependencies=[Depends(verify_api_token)])

class LeagueSchema(BaseModel):
    id: int
    name: str
    sport_id: Optional[int] = None
    region: Optional[str] = None
    
    class Config:
        orm_mode = True

class LeagueSeed(BaseModel):
    id: int
    name: str

@router.get("/", response_model=List[LeagueSchema])
async def list_leagues(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(League)
    
    if search:
        filters = [League.name.ilike(f"%{search}%")]
        if search.isdigit():
            filters.append(League.id == int(search))
        query = query.filter(or_(*filters))
        
    return query.order_by(League.name).offset(skip).limit(limit).all()

@router.post("/seed")
async def seed_leagues(
    leagues: List[LeagueSeed],
    db: Session = Depends(get_db)
):
    """Bulk upsert leagues"""
    count = 0
    for l in leagues:
        # Check exist
        existing = db.query(League).filter(League.id == l.id).first()
        if existing:
            existing.name = l.name # Update name
        else:
            db.add(League(id=l.id, name=l.name))
        count += 1
    
    db.commit()
    return {"message": f"{count} leagues processed"}
