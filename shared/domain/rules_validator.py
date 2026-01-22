from typing import List, Optional, Any, Dict
from sqlalchemy.orm import Session
from datetime import datetime
from shared.database import get_db_session, SessionLocal
from shared.models.event import Event


def get_active_events(db: Optional[Session] = None) -> List[Event]:
    """Aktif event'leri çek (status='active' ve tarih aralığında olanlar)."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True
    
    try:
        now = datetime.utcnow()
        events = db.query(Event).filter(
            Event.status == "active",
            Event.start_date <= now,
            Event.end_date >= now
        ).all()
        return events
    except Exception as e:
        logger.error(f"Error fetching active events: {e}")
        return []
    finally:
        if should_close:
            db.close()


def is_valid_for_event(bet_history: dict, selections_data: dict, event: Event) -> bool:
    """
    Bir kuponun belirli bir event kurallarına uygun olup olmadığını kontrol eder.
    """
    rules = event.rules or {}
    
    # 1. Kombine sayısı kontrolü
    bet_type = bet_history.get("Type", 0)
    min_combination = rules.get("min_combination", 2)
    if bet_type < min_combination:
        return False
    
    # 2. Minimum stake kontrolü
    stake = bet_history.get("EquivalentAmount", 0.0)
    min_stake = rules.get("min_stake", 100.0)
    if stake < min_stake:
        return False
    
    # 3. Live kupon kontrolü
    
    # 4. Selection bazlı kontroller (oran ve lig)
    data_field = selections_data.get("Data", [])
    if isinstance(data_field, list):
        selections = data_field
    elif isinstance(data_field, dict):
        selections = data_field.get("Objects", []) or data_field.get("Selections", []) or []
    else:
        selections = []
    
    if not selections:
        selections = selections_data.get("Selections", []) or []
    
    if not selections:
        return False
    
    min_odd = rules.get("min_odd", 1.5)
    allowed_league_ids = rules.get("allowed_league_ids", [])
    
    for selection in selections:
        # Oran kontrolü
        price = selection.get("Price", 0.0)
        if price < min_odd:
            return False
        
        # Lig kontrolü (eğer allowed_league_ids boş değilse)
        if allowed_league_ids:
            competition_id = selection.get("CompetitionId")
            if competition_id is None or competition_id not in allowed_league_ids:
                return False
    
    return True


def get_eligible_events_for_coupon(bet_history: dict, selections_data: dict, db: Optional[Session] = None) -> List[Event]:
    """
    Bir kuponun uygun olduğu tüm aktif event'leri döndürür.
    """
    active_events = get_active_events(db=db)
    eligible_events = []
    
    for event in active_events:
        if is_valid_for_event(bet_history, selections_data, event):
            eligible_events.append(event)
    
    return eligible_events


    return eligible_events

