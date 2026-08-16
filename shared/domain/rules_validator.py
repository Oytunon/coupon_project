from typing import List, Optional, Any, Dict
from sqlalchemy.orm import Session
from datetime import datetime
import logging
from shared.database import get_db_session, SessionLocal, get_retrying_session
from shared.models.event import Event

logger = logging.getLogger(__name__)


def get_active_events(db: Optional[Session] = None) -> List[Event]:
    """Aktif event'leri çek (status='active' ve tarih aralığında olanlar)."""
    from datetime import timedelta
    should_close = False
    if db is None:
        db = get_retrying_session()
        should_close = True
    
    try:
        # ÖNEMLİ: Event tarihleri TR saati (UTC+3) olarak saklanıyor
        # Bu yüzden UTC'ye +3 saat ekleyerek TR saatiyle karşılaştırıyoruz
        tr_offset = timedelta(hours=3)
        now_tr = datetime.utcnow() + tr_offset
        events = db.query(Event).filter(
            Event.status == "active",
            Event.start_date <= now_tr,
            Event.end_date >= now_tr
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
        
    max_combination = rules.get("max_combination")
    if max_combination is not None and bet_type > max_combination:
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
    allowed_league_ids = list(rules.get("allowed_league_ids") or []) + list(rules.get("yan_bahis_ids") or [])
    
    for selection in selections:
        # Oran kontrolü
        price = selection.get("Price", 0.0)
        if price < min_odd:
            return False
        
        # Lig kontrolü (eğer allowed_league_ids boş değilse)
        # String karşılaştırma: API int/string dönebilir, allowed_league_ids int
        if allowed_league_ids:
            competition_id = selection.get("CompetitionId")
            allowed_str = [str(lid) for lid in allowed_league_ids]
            if competition_id is None or str(competition_id) not in allowed_str:
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

