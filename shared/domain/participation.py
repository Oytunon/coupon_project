from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import Optional
from shared.models.participant import Participant
from shared.models.event import Event
from shared.models.enrollment import EventParticipant
from shared.services.bapi import fetch_client_id_by_login, has_single_deposit

async def check_user_enrollment(
    db: Session,
    username: Optional[str] = None,
    client_id: Optional[int] = None,
    event_id: Optional[int] = None,
    slug: Optional[str] = None
):
    # Determine Event
    target_event = None
    if slug:
        target_event = db.query(Event).filter(Event.slug == slug).first()
    elif event_id:
        target_event = db.query(Event).filter(Event.id == event_id).first()
    else:
        target_event = db.query(Event).filter(Event.status == "active").first()
        
    if not target_event:
        return {"can_join": False, "reason": "event_not_found"}

    if target_event.status != "active":
        return {"can_join": False, "reason": "event_not_active"}

    now_tr = datetime.utcnow() + timedelta(hours=3)
    if target_event.end_date < now_tr:
        return {"can_join": False, "reason": "event_expired"}

    # Resolve Client ID - SADECE DB'den. GetClients SADECE Katıl butonunda (join_event) çağrılır.
    if username:
        existing_participant = db.query(Participant).filter(Participant.username == username).first()
        if existing_participant:
            client_id = existing_participant.client_id
            participant = existing_participant
        else:
            # DB'de yok = henüz katılmamış. GetClients ÇAĞIRMIYORUZ (sayfa açılışında rate limit).
            # Katıl butonuna basınca join_event GetClients yapacak.
            return {"can_join": True, "joined": False, "event_name": target_event.name}
    elif not client_id:
        return {"can_join": False, "reason": "missing_client_id"}
    else:
        participant = db.query(Participant).filter_by(client_id=client_id).first()
        if not participant:
            return {"can_join": True, "joined": False, "event_name": target_event.name}
         
    enrollment = db.query(EventParticipant).filter_by(
        event_id=target_event.id,
        participant_id=participant.id
    ).first()
    
    is_joined = enrollment is not None
    response_data = {
        "can_join": not is_joined,
        "joined": is_joined,
        "event_name": target_event.name
    }

    if is_joined:
        all_participants = db.query(EventParticipant).filter_by(event_id=target_event.id).order_by(EventParticipant.total_points.desc()).all()
        rank = next((idx for idx, p in enumerate(all_participants, 1) if p.participant_id == participant.id), 0)
        response_data["score"] = enrollment.total_points
        response_data["rank"] = rank

    return response_data

async def join_event(
    db: Session,
    username: Optional[str] = None,
    client_id: Optional[int] = None,
    event_id: Optional[int] = None,
    slug: Optional[str] = None
):
    # Determine Event
    target_event = None
    if slug:
        target_event = db.query(Event).filter(Event.slug == slug).first()
    elif event_id:
        target_event = db.query(Event).filter(Event.id == event_id).first()
    else:
        target_event = db.query(Event).filter(Event.status == "active").first()
        
    if not target_event:
        raise HTTPException(status_code=404, detail="Turnuva bulunamadı")

    if target_event.status != "active":
        raise HTTPException(status_code=400, detail="Bu turnuva şu an aktif değil.")

    now_tr = datetime.utcnow() + timedelta(hours=3)
    if target_event.end_date < now_tr:
        raise HTTPException(status_code=400, detail="Bu turnuvanın süresi dolmuştur.")
        
    # Resolve User
    resolved_username = username

    if username:
        # Optimization: Check DB first
        existing_participant = db.query(Participant).filter(Participant.username == username).first()
        if existing_participant:
            client_id = existing_participant.client_id

        else:
            resolved_client_id = await fetch_client_id_by_login(username)

            if not resolved_client_id:
                raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı - FROM DEBUG CONTAINER")
            client_id = resolved_client_id
        

    elif not client_id:
        raise HTTPException(status_code=400, detail="Username veya client_id gereklidir")
        
    # Pre-fetch rules
    try:
        min_deposit = int(target_event.rules.get("min_deposit") or 0)
    except (TypeError, ValueError):
        min_deposit = 0
    event_id_val = target_event.id
    event_name_val = target_event.name
    
    # 3. Participant management
    participant = db.query(Participant).filter_by(client_id=client_id).first()
    if not participant:
        participant = Participant(client_id=client_id, username=resolved_username, joined_at=datetime.utcnow())
        db.add(participant)
        db.flush()
    elif resolved_username and not participant.username:
        participant.username = resolved_username
        
    # 4. Enrollment Check
    exists = db.query(EventParticipant).filter_by(event_id=event_id_val, participant_id=participant.id).first()
    if exists:
        return {"status": "already_joined", "message": "Zaten katılımcısınız"}
        
    # 5. Eligibility Check
    eligible = await has_single_deposit(client_id, min_deposit)
    if not eligible:
         raise HTTPException(status_code=403, detail=f"Minimum {min_deposit} TL yatırım şartı sağlanmamış")
         
    # 6. Final Join
    enrollment = EventParticipant(event_id=event_id_val, participant_id=participant.id)
    db.add(enrollment)
    db.commit()
    
    return {"status": "joined", "event": event_name_val}
