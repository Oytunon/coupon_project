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

                logger.info(f"Kullanıcı taranıyor: {user.username} (Client ID: {user.client_id})")

                start_date, end_date = get_date_range()
                bet_history_data = await fetch_bet_history(user.client_id, start_date, end_date)
                bets = []
                if bet_history_data:
                    bets = bet_history_data.get("Bets", [])
                
                for bet_history in bets:
                    user_processed_count += 1
                    bet_id = bet_history.get("BetId") or bet_history.get("Id")
                    
                    if not bet_id: continue
                    
                    state_value = bet_history.get("State") or bet_history.get("Status") or 0
                    if isinstance(state_value, str):
                        try:
                            state_value = int(state_value)
                        except ValueError:
                            state_value = state_value.lower()
                    
                    state_mapping = {1: "open", 2: "cashout", 3: "lost", 4: "won", 5: "cancelled", 6: "returned"}
                    if isinstance(state_value, int):
                        state = state_mapping.get(state_value, "open")
                    else:
                        state = state_value if isinstance(state_value, str) else "open"
                    
                    state = state.lower()

                    if state not in ["won", "lost"]:
                        continue

                    
                    eligible_for_events = []
                    
                    for target_event in user_target_events:
                        rules = target_event.rules or {}
                        
                        # Stake Check
                        min_stake = rules.get("min_stake", 0)
                        stake = float(bet_history.get("EquivalentAmount", 0.0) or 0.0)
                        if stake < min_stake:
                            continue

                        # Type (Combo) Check
                        min_selection_count = rules.get("min_selection_count", 1)
                        selection_count = int(bet_history.get("Type", 0) or 0)
                        if selection_count < min_selection_count:
                            continue
                            
                        eligible_for_events.append(target_event)

                    if not eligible_for_events:
                        continue

                    if not eligible_for_events:
                        continue

                    selections_data = await fetch_bet_selections(bet_id)
                    if not selections_data: continue
                    
                    data_field = selections_data.get("Data", [])
                    selections = []
                    if isinstance(data_field, list): selections = data_field
                    elif isinstance(data_field, dict): selections = data_field.get("Objects", []) or []
                    if not selections: selections = selections_data.get("Selections", []) or []

                    total_odds = 1.0
                    
                    # Filter events again based on selection criteria
                    final_eligible_events = []
                    
                    for target_event in eligible_for_events:
                        rules = target_event.rules or {}
                        min_odds = rules.get("min_odds", 1.0)
                        allowed_leagues = rules.get("allowed_leagues", []) # List of CompetitionId strings or ints

                        # Check each selection
                        all_selections_valid = True
                        current_total_odds = 1.0
                        
                        for sel in selections:
                            price = float(sel.get("Price", 1.0) or 1.0)
                            current_total_odds *= price
                            
                            # 3. Odds Check per selection
                            if price < min_odds:
                                all_selections_valid = False
                                break
                            
                            # 4. League Check per selection
                            if allowed_leagues:
                                comp_id = sel.get("CompetitionId")
                                # Normalize comparison (str/int)
                                if str(comp_id) not in [str(x) for x in allowed_leagues]:
                                    all_selections_valid = False
                                    break
                        
                        if all_selections_valid:
                            final_eligible_events.append(target_event)
                            # Update total_odds (loop runs once per bet anyway for odds calc)
                            total_odds = current_total_odds

                    if not final_eligible_events:
                        continue
                        
                    possible_events = final_eligible_events
                    
                    for event in possible_events:
                        if event.id not in user_enrolled_event_ids: continue

                        exists_coupon = db.query(Coupon).filter(
                             Coupon.bet_id == str(bet_id),
                             Coupon.event_id == event.id
                        ).first()

                        if exists_coupon: continue
                        
                        # Use unified scoring logic
                        calc_points, calc_detail = calculate_points_for_event(
                            Coupon(stake=float(bet_history.get("EquivalentAmount", 0.0) or 0.0), 
                                   odds=float(total_odds), 
                                   combination_count=int(bet_history.get("Type", 0) or 0),
                                   state=state),
                            event
                        )
                        
                        created_at = datetime.utcnow() # Fallback if not available in bet_history
                        
                        new_coupon = Coupon(
                            client_id=user.client_id,
                            bet_id=str(bet_id),
                            event_id=event.id,
                            created_at=created_at,
                            stake=float(bet_history.get("EquivalentAmount", 0.0) or 0.0),
                            odds=float(total_odds),
                            combination_count=int(bet_history.get("Type", 0) or 0),
                            is_live=bool(bet_history.get("IsLive", False) or False),
                            state=state,
                            winning=float(bet_history.get("Winning", 0.0) or 0.0),
                            calculation=calc_points,
                            is_processed=True,
                            processed_at=datetime.utcnow(),
                            bet_data=bet_history # Save full bet history as JSON
                        )
                        db.add(new_coupon)
                        user_saved_count += 1
                        logger.info(f"✅ Kupon {bet_id} eklendi. Event: {event.name}, Puan: {calc_points:.2f}")

                db.commit() # User batch commit
                
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
