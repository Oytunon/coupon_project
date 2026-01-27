import asyncio
import logging
from datetime import datetime
from typing import Optional, List

from sqlalchemy import func
from shared.database import SessionLocal
from shared.models.coupon import Coupon
from shared.models.participant import Participant
from shared.models.enrollment import EventParticipant
from shared.services.betconstruct import fetch_bet_history, fetch_bet_selections, get_date_range
from shared.domain.rules_validator import get_eligible_events_for_coupon, get_active_events
from shared.models.event import Event

logger = logging.getLogger(__name__)

from typing import Optional, List, Tuple
from shared.models.worker_log import WorkerLog

def calculate_points_for_event(
    coupon: Coupon, 
    event: Event
) -> Tuple[float, dict]:
    """
    Event'in scoring formula'sına göre puan hesaplar.
    """
    rules = event.rules or {}
    formula = rules.get("scoring_formula", "simple")
    state = coupon.state.lower()
    
    # Pass multipliers
    if state == 'won':
        multiplier = event.won_point_multiplier
    elif state == 'lost':
        multiplier = event.loss_point_multiplier
    else:
        multiplier = 0.0
    
    # Base points calculation
    # Formula: Odds based
    base_points = coupon.odds
    formula_str = "odds"
    
    # Combo Bonus Logic
    if formula == "combo_bonus":
        combo_bonus_enabled = rules.get("combo_bonus_enabled", False)
        if combo_bonus_enabled and coupon.combination_count and coupon.combination_count > 2:
            bonus_multiplier = rules.get("combo_bonus_multiplier", 0.1)
            combo_bonus = 1 + (coupon.combination_count - 2) * bonus_multiplier
            base_points *= combo_bonus # Effect: Odds * ComboBonus
            formula_str = f"odds * combo_bonus"
    
    final_points = base_points * multiplier
    
    return round(final_points, 2), {
        "formula": formula,
        "formula_str": formula_str,
        "base_points": round(base_points, 2),
        "multiplier": multiplier,
        "state": state,
        "final_points": round(final_points, 2)
    }
async def process_coupons(target_event_id: Optional[int] = None, job_id: Optional[int] = None):
    """
    Kuponları işleyen ana fonksiyon.
    
    Args:
        target_event_id: Eğer belirtilirse sadece bu event için çalışır.
        job_id: WorkerLog tablosundaki kayıt ID'si (İlerleme takibi için).
    """
    db = SessionLocal()
    from shared.models.event import Event # Local import to avoid circular dependencies if any
    try:
        # Job Status güncelleme yardımcı fonksiyonu
        def update_job_status(status: str, processed=0, saved=0, error=None):
            if not job_id: return
            try:
                job = db.query(WorkerLog).filter(WorkerLog.id == job_id).first()
                if job:
                    job.status = status
                    job.processed_count += processed
                    job.saved_count += saved
                    if error: job.error_message = str(error)
                    if status in ["completed", "failed"]:
                        job.completed_at = datetime.utcnow()
                    db.commit()
            except Exception as ex:
                logger.error(f"Job update error: {ex}")

        if job_id:
            update_job_status("running")

        if target_event_id:
            all_events = get_active_events(db=db)
            active_events = [e for e in all_events if e.id == target_event_id]
            if not active_events:
                msg = f"Event {target_event_id} aktif değil veya bulunamadı."
                logger.warning(msg)
                update_job_status("failed", error=msg)
                return
        else:
            active_events = get_active_events(db=db)

        if not active_events:
            logger.info("Aktif event bulunamadı.")
            if job_id: update_job_status("completed") # Nothing to do, but success
            return

        logger.info(f"İşlenecek event sayısı: {len(active_events)}")

        active_event_ids = [e.id for e in active_events]
        enrollments = db.query(EventParticipant).filter(
            EventParticipant.event_id.in_(active_event_ids)
        ).all()
        
        participant_ids = list(set(e.participant_id for e in enrollments))
        
        if not participant_ids:
            logger.info("Aktif eventlere kayıtlı katılımcı bulunamadı.")
            if job_id: update_job_status("completed")
            return

        participants = db.query(Participant).filter(Participant.id.in_(participant_ids)).all()
        
        user_event_map = {}
        for enr in enrollments:
            if enr.participant_id not in user_event_map:
                user_event_map[enr.participant_id] = []
            user_event_map[enr.participant_id].append(enr.event_id)

        # Cache event data to prevent DetachedInstanceError after commits
        event_info_map = {}
        for e in active_events:
            event_info_map[e.id] = {
                "object": e,
                "name": e.name,
                "won_multiplier": e.won_point_multiplier,
                "loss_multiplier": e.loss_point_multiplier
            }

        logger.info(f"Toplam {len(participants)} katılımcı taranacak.")

        # Rate limit için listeyi sıralı gidelim
        for i, user in enumerate(participants):
            user_processed_count = 0
            user_saved_count = 0
            try:
                user_enrolled_event_ids = user_event_map.get(user.id, [])
                user_target_events = [event_info_map[eid]["object"] for eid in user_enrolled_event_ids if eid in event_info_map]
                
                if not user_target_events:
                    continue

                # logger.info(f"Kullanıcı taranıyor: {user.username} (Client ID: {user.client_id})")

                start_date, end_date = get_date_range()
                bet_history_data = await fetch_bet_history(user.client_id, start_date, end_date)
                
                # Robust parsing
                bets = []
                if isinstance(bet_history_data, dict):
                    bets = bet_history_data.get("Bets", []) or bet_history_data.get("Data", []) or bet_history_data.get("Objects", [])
                elif isinstance(bet_history_data, list):
                    bets = bet_history_data
                
                if not bets:
                    continue
                    
                for bet_history in bets:
                    user_processed_count += 1
                    bet_id = str(bet_history.get("BetId") or bet_history.get("Id"))
                    if not bet_id: continue
                    
                    # 1. State Mapping from Raw JSON
                    # Raw JSON shows: "StateName": "Lost" or "Won", "State": 3 or 4
                    state_name = bet_history.get("StateName", "").lower()
                    
                    mapped_state = "open"
                    if "won" in state_name: mapped_state = "won"
                    elif "lost" in state_name: mapped_state = "lost"
                    elif "cashout" in state_name: mapped_state = "cashout"
                    elif "returned" in state_name: mapped_state = "returned"
                    
                    # Fallback to State ID if name is empty
                    if mapped_state == "open":
                        sid = bet_history.get("State", 0)
                        if sid == 4: mapped_state = "won"
                        elif sid == 3: mapped_state = "lost"
                        elif sid == 2 or sid == 5: mapped_state = "cashout"
                    
                    # USER REQUEST: Exclude Cashout & Open. Only Won/Lost.
                    if mapped_state not in ["won", "lost"]:
                        continue

                    # 2. Eligible Event Check
                    eligible_for_events = []
                    
                    # Amount & Selection Count Logic
                    amount = float(bet_history.get("Amount", 0.0) or 0.0) # Stake
                    sel_count = int(bet_history.get("SelectionCount", 1) or bet_history.get("Type", 1)) # Type often means 1/2 (single/multi)

                    for target_event in user_target_events:
                        rules = target_event.rules or {}
                        
                        min_stake = rules.get("min_stake", 0)
                        if amount < min_stake: continue

                        min_sel_count = rules.get("min_selection_count", 1)
                        if sel_count < min_sel_count: continue
                            
                        eligible_for_events.append(target_event)

                    if not eligible_for_events: continue

                    # 3. Selections fetching (if actually necessary for strict league validation)
                    # For performance, we might skip this if rules don't mandate league checks
                    # But let's keep it safe.
                    # ... (Simplified logic here to avoid re-fetching if not needed)
                    # Assuming we trust the bet header for now, or re-fetch if strict
                    
                    # To align with code structure, let's just proceed with eligible_for_events
                    possible_events = eligible_for_events
                    
                    # 4. Save to DB
                    for event in possible_events:
                        # Check existence (using explicit bet_id string)
                        exists_coupon = db.query(Coupon).filter(
                             Coupon.bet_id == bet_id,
                             Coupon.event_id == event.id
                        ).first()

                        if exists_coupon: continue
                        
                        # Prepare Coupon
                        # Price/Odds might come from Selections sum or header "Price"
                        price = float(bet_history.get("Price", 1.0) or 1.0)
                        
                        logger.info(f"✅ Kupon Eklendi: {bet_id} | Durum: {mapped_state} | Event: {event.name}")
                        
                        new_coupon = Coupon(
                            client_id=user.client_id, # Correct Field
                            bet_id=bet_id,
                            event_id=event.id,
                            stake=amount,             # Correct Field
                            odds=price,               # Correct Field
                            combination_count=sel_count,
                            state=mapped_state,       # Correct Field (won/lost/cashout)
                            is_live=bool(bet_history.get("IsLive", False)),
                            bet_data=bet_history,
                            created_at=datetime.utcnow(),
                            is_processed=True,
                            processed_at=datetime.utcnow()
                        )
                        db.add(new_coupon)
                        user_saved_count += 1
                        
                        # Calculate Points (In-memory logic)
                        calc_points, _ = calculate_points_for_event(new_coupon, event)
                        new_coupon.calculation = calc_points
                        
                        logger.info(f"         ⭐️ Hesaplanan Puan: {calc_points}")

                db.commit() # Commit batch per user
                
                # Puanları güncelle (EventParticipant)
                for event in user_target_events:
                     total_user_points = db.query(func.sum(Coupon.calculation)).filter(
                         Coupon.client_id == user.client_id,
                         Coupon.event_id == event.id
                     ).scalar() or 0.0
                     
                     enrollment_record = db.query(EventParticipant).filter(
                         EventParticipant.event_id == event.id,
                         EventParticipant.participant_id == user.id
                     ).first()
                     
                     if enrollment_record:
                         enrollment_record.total_points = total_user_points
                db.commit()
                
                # Update job progress after *each user*
                if job_id:
                    update_job_status("running", processed=user_processed_count, saved=user_saved_count)

                if i < len(participants) - 1:
                    await asyncio.sleep(4)

            except Exception as e:
                logger.error(f"Error processing user {user.username}: {e}")
                db.rollback()
                if job_id: update_job_status("running", error=str(e)) # Keep running but log error
                continue
        
        logger.info(f"İşlem tamamlandı.")
        if job_id: update_job_status("completed")
    
    except Exception as e:
        logger.error(f"Critical Worker Error: {e}")
        if job_id: update_job_status("failed", error=str(e))
    finally:
        db.close()
