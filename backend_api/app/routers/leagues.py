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
        search_lower = search.lower()
        filters = [League.name.ilike(f"%{search}%")]
        if search.isdigit():
            filters.append(League.id == int(search))
            
        if "futbol" in search_lower:
            filters.append(League.sport_id == 1)
        elif "basketbol" in search_lower:
            filters.append(League.sport_id == 2)
        elif "voleybol" in search_lower:
            filters.append(League.sport_id == 3)
        elif "tenis" in search_lower:
            filters.append(League.sport_id == 4)
            
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

@router.post("/", response_model=LeagueSchema)
async def create_league(
    league: LeagueSchema,
    db: Session = Depends(get_db)
):
    existing = db.query(League).filter(League.id == league.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="League with this ID already exists")
    
    new_league = League(
        id=league.id,
        name=league.name,
        sport_id=league.sport_id,
        region=league.region
    )
    db.add(new_league)
    db.commit()
    db.refresh(new_league)
    return new_league

@router.put("/{league_id}", response_model=LeagueSchema)
async def update_league(
    league_id: int,
    league_data: LeagueSchema,
    db: Session = Depends(get_db)
):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
        
    league.name = league_data.name
    league.sport_id = league_data.sport_id
    league.region = league_data.region
    
    db.commit()
    db.refresh(league)
    return league

@router.delete("/{league_id}")
async def delete_league(
    league_id: int,
    db: Session = Depends(get_db)
):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
        
    db.delete(league)
    db.commit()
    return {"message": "League deleted successfully"}
