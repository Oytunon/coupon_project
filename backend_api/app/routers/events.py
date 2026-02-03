from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from io import BytesIO
import openpyxl

from shared.database import get_db_session
from shared.models.event import Event
from shared.models.coupon_event_result import CouponEventResult
from shared.models.admin import AdminUser
from shared.models.coupon import Coupon
from shared.models.participant import Participant
from shared.models.enrollment import EventParticipant
from backend_api.app.security import get_current_admin

router = APIRouter(prefix="/api/admin/events", tags=["admin-events"])


# === Pydantic Schemas ===

class EventRules(BaseModel):
    model_config = {"extra": "allow"}
    min_stake: float = 100.0
    min_odd: float = 1.5
    min_combination: int = 2
    max_combination: Optional[int] = None
    allowed_league_ids: List[int] = []
    max_coupons_per_user: Optional[int] = None
    scoring_formula: str = "stake_times_odds"  # 'simple', 'stake_times_odds', 'combo_bonus'
    combo_bonus_enabled: bool = False
    combo_bonus_multiplier: float = 0.1
    min_deposit: int = 1000


class EventCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    won_point_multiplier: float = 1.0
    loss_point_multiplier: float = 0.0
    rules: EventRules


class EventUpdate(BaseModel):
    model_config = {"extra": "allow"}
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    won_point_multiplier: Optional[float] = None
    loss_point_multiplier: Optional[float] = None
    rules: Optional[EventRules] = None


class EventStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(draft|active|paused|ended|archived)$")


class EventResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str]
    status: str
    start_date: datetime
    end_date: datetime
    won_point_multiplier: float
    loss_point_multiplier: float
    rules: dict
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class EventStatsResponse(BaseModel):
    event_id: int
    event_name: str
    status: str
    total_participants: int
    total_coupons: int
    eligible_coupons: int
    won_coupons: int
    lost_coupons: int
    pending_coupons: int
    total_stake: float
    total_points_distributed: float
    avg_points_per_user: float
    avg_stake: float



# === Endpoints ===

@router.post("", response_model=EventResponse, status_code=201)
async def create_event(
    event_data: EventCreate,
    db: Session = Depends(get_db_session),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Yeni event oluştur."""
    try:
        print(f"DEBUG_CREATE_EVENT: Data={event_data.dict()}")

        # Date validation
        if event_data.end_date <= event_data.start_date:
            raise HTTPException(400, "End date must be after start date")
        
        # Auto-generate slug if not provided
        slug_to_use = event_data.slug
        if not slug_to_use:
            from slugify import slugify
            import uuid
            base_slug = slugify(event_data.name)
            slug_to_use = f"{base_slug}-{uuid.uuid4().hex[:6]}"

        # Slug uniqueness ensure
        existing = db.query(Event).filter(Event.slug == slug_to_use).first()
        if existing:
             # Retry once with different random suffix if collision (rare)
             import uuid
             from slugify import slugify
             base_slug = slugify(event_data.name)
             slug_to_use = f"{base_slug}-{uuid.uuid4().hex[:6]}"

        event = Event(
            name=event_data.name,
            slug=slug_to_use,
            description=event_data.description,
            start_date=event_data.start_date,
            end_date=event_data.end_date,
            won_point_multiplier=event_data.won_point_multiplier,
            loss_point_multiplier=event_data.loss_point_multiplier,
            rules=event_data.rules.dict(),
            created_by=current_admin.id,
            status="draft" 
        )
        
        db.add(event)
        db.commit()
        db.refresh(event)
        
        return event
    except Exception as e:
        print(f"DEBUG_CREATE_EVENT_ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        raise e


@router.get("", response_model=List[EventResponse])
async def list_events(
    status: Optional[str] = Query(None, pattern="^(draft|active|paused|ended|archived)$"),
    db: Session = Depends(get_db_session),
    _: AdminUser = Depends(get_current_admin)
):
    """Tüm eventleri listele."""
    query = db.query(Event)
    if status:
        query = query.filter(Event.status == status)
    
    return query.order_by(Event.created_at.desc()).all()


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    db: Session = Depends(get_db_session),
    _: AdminUser = Depends(get_current_admin)
):
    """Event detayını getir."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    return event


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event_data: EventUpdate,
    db: Session = Depends(get_db_session),
    _: AdminUser = Depends(get_current_admin)
):
    """Event'i güncelle."""
    import logging
    from sqlalchemy.orm.attributes import flag_modified
    logger = logging.getLogger("backend_api")
    
    # Received data log
    data_dict = event_data.dict(exclude_unset=True)
    logger.info(f"PUT /admin/events/{event_id} - Body: {data_dict}")

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        logger.error(f"Event not found: {event_id}")
        raise HTTPException(404, "Event not found")
    
    # 1. Slug check
    if "slug" in data_dict and data_dict["slug"] != event.slug:
        existing = db.query(Event).filter(Event.slug == data_dict["slug"]).first()
        if existing:
            logger.error(f"Slug already in use: {data_dict['slug']}")
            raise HTTPException(400, "Slug already in use")

    # 2. Update simple fields
    for field, value in data_dict.items():
        if field != "rules":
            logger.info(f"Updating {field}: {getattr(event, field)} -> {value}")
            setattr(event, field, value)

    # 3. Update rules (Nested merge)
    if "rules" in data_dict and data_dict["rules"]:
        current_rules = dict(event.rules or {})
        new_rules = data_dict["rules"]
        if hasattr(new_rules, "dict"):
            new_rules = new_rules.dict(exclude_unset=True)
        elif hasattr(new_rules, "model_dump"):
            new_rules = new_rules.model_dump(exclude_unset=True)
            
        merged_rules = {**current_rules, **new_rules}
        logger.info(f"Rules update: {current_rules} -> {merged_rules}")
        event.rules = merged_rules
        # Explicitly mark rules as modified for SQLAlchemy
        flag_modified(event, "rules")
    
    # 4. Final validation
    if event.end_date <= event.start_date:
        logger.error(f"Invalid dates: {event.start_date} -> {event.end_date}")
        raise HTTPException(400, "End date must be after start date")
    
    try:
        event.updated_at = datetime.now()
        db.commit()
        db.refresh(event)
        logger.info(f"Event {event_id} successfully saved and committed")
        return event
    except Exception as e:
        db.rollback()
        logger.error(f"Save failed for event {event_id}: {str(e)}")
        raise HTTPException(500, f"Database save error: {str(e)}")


@router.delete("/{event_id}", status_code=204)
async def delete_event(
    event_id: int,
    db: Session = Depends(get_db_session),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Event'i sil."""
    # Updated: Allow regular admins to delete events as well, since there is no UI to create superadmins easily yet.
    if current_admin.role not in ["admin", "superadmin"]:
        raise HTTPException(403, "Not authorized to delete events")
    
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    
    try:
        # Manually delete related records to bypass missing DB-level CASCADE
        from shared.models.worker_log import WorkerLog
        
        # 1. Delete Worker Logs
        db.query(WorkerLog).filter(WorkerLog.event_id == event_id).delete(synchronize_session=False)
        
        # 2. Delete Results
        db.query(CouponEventResult).filter(CouponEventResult.event_id == event_id).delete(synchronize_session=False)

        # 3. Delete Participants (Enrollment)
        db.query(EventParticipant).filter(EventParticipant.event_id == event_id).delete(synchronize_session=False)

        # 4. Detach coupons
        # We use explicit dictionary for update to be safe and compatible
        db.query(Coupon).filter(Coupon.event_id == event_id).update({"event_id": None}, synchronize_session=False)
        
        # Now delete event
        db.delete(event)
        db.commit()
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        # Return the specific error to the client
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
        
    return None


@router.patch("/{event_id}/status", response_model=EventResponse)
async def update_event_status(
    event_id: int,
    status_data: EventStatusUpdate,
    db: Session = Depends(get_db_session),
    _: AdminUser = Depends(get_current_admin)
):
    """Event status'ünü güncelle."""
    import logging
    logger = logging.getLogger("backend_api")
    logger.info(f"PATCH /admin/events/{event_id}/status: {status_data.status}")

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        logger.error(f"Event not found: {event_id}")
        raise HTTPException(404, "Event not found")
    
    event.status = status_data.status
    event.updated_at = datetime.now()
    db.commit()
    db.refresh(event)
    logger.info(f"Status updated successfully for event {event_id}")
    return event


@router.get("/{event_id}/stats", response_model=EventStatsResponse)
async def get_event_stats(
    event_id: int,
    db: Session = Depends(get_db_session),
    _: AdminUser = Depends(get_current_admin)
):
    """Event istatistiklerini getir."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    
    from shared.domain.event_stats import get_event_metrics
    metrics = get_event_metrics(db, event_id)
    
    return EventStatsResponse(
        event_id=event_id,
        event_name=event.name,
        status=event.status,
        **metrics
    )


@router.post("/{event_id}/recalculate", status_code=202)
async def recalculate_event_points(
    event_id: int,
    db: Session = Depends(get_db_session),
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Event'in tüm puanlarını yeniden hesapla."""
    if current_admin.role != "superadmin":
        raise HTTPException(403, "Only superadmin can recalculate points")
    
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    
    from shared.domain.scoring_engine import calculate_points_for_event
    
    results = db.query(CouponEventResult).filter(
        CouponEventResult.event_id == event_id,
        CouponEventResult.is_eligible == True
    ).all()
    
    recalculated_count = 0
    for cer in results:
        coupon = db.query(Coupon).filter(Coupon.id == cer.coupon_id).first()
        if coupon:
            new_points, calculation = calculate_points_for_event(coupon, event)
            cer.points_earned = new_points
            cer.points_calculation = calculation
            cer.evaluated_at = datetime.now()
            recalculated_count += 1
    
    db.commit()
    return {
        "message": f"Recalculated {recalculated_count} coupon points for event {event.name}",
        "recalculated_count": recalculated_count
    }


@router.post("/{event_id}/worker", status_code=202)
async def run_event_worker(
    event_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session),
    _: AdminUser = Depends(get_current_admin)
):
    """Worker'ı manuel tetikle."""
    from shared.models.worker_log import WorkerLog
    from shared.domain.scoring_engine import process_coupons
    
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    
    job = WorkerLog(event_id=event_id, status="pending")
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(process_coupons, target_event_id=event_id, job_id=job.id)
    return {"status": "initiated", "message": "Worker started", "job_id": job.id}


@router.get("/{event_id}/participants")
async def get_event_participants_list(
    event_id: int,
    db: Session = Depends(get_db_session),
    _: AdminUser = Depends(get_current_admin)
):
    """Etkinliğe katılan kullanıcıları getir (Puan sıralı)."""
    from shared.domain.leaderboard import get_event_leaderboard
    return get_event_leaderboard(db, event_id)


@router.get("/{event_id}/participants/export")
async def export_event_participants(
    event_id: int,
    db: Session = Depends(get_db_session),
    _: AdminUser = Depends(get_current_admin)
):
    """Etkinlik katılımcılarını Excel olarak indir."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")

    from shared.domain.leaderboard import get_event_leaderboard
    results = get_event_leaderboard(db, event_id)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Katilimcilar"
    ws.append(["ID", "Kullanici Adi", "Client ID", "Katilim Tarihi", "Kupon Sayisi", "Toplam Puan"])

    for p in results:
        ws.append([
            p["id"], p["username"], p["client_id"],
            p["joined_at"].strftime("%Y-%m-%d %H:%M:%S") if p["joined_at"] else "-",
            p["coupon_count"], p["points"]
        ])

    output = BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"{event.slug}_participants_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        output,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


@router.get("/{event_id}/coupons/export")
async def export_event_coupons(
    event_id: int,
    db: Session = Depends(get_db_session),
    _: AdminUser = Depends(get_current_admin)
):
    """Etkinlikte puan kazanan kuponları Excel olarak indir."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")

    # Sadece puan kazandıran kuponları çek (is_processed=True ve calculation > 0)
    coupons = db.query(Coupon).filter(
        Coupon.event_id == event_id,
        Coupon.is_processed == True
    ).order_by(Coupon.processed_at.desc()).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Kuponlar"
    ws.append(["ID", "Client ID", "Bet ID", "Tarih", "Stake", "Odds", "State", "Puan", "Live?"])

    for c in coupons:
        ws.append([
            c.id, c.client_id, c.bet_id,
            c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else "-",
            c.stake, c.odds, c.state, c.calculation,
            "YES" if c.is_live else "NO"
        ])

    output = BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"{event.slug}_coupons_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        output,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

