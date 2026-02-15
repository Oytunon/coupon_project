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
    # Formula: Odds based or Stake * Odds
    base_points = coupon.odds
    formula_str = "odds"

    if formula == "stake_times_odds":
        base_points = (coupon.stake * coupon.odds) / 10
        formula_str = "(stake * odds) / 10"
    
    # Combo Bonus Logic
    if formula == "combo_bonus":
        combo_bonus_enabled = rules.get("combo_bonus_enabled", False)
        if combo_bonus_enabled and coupon.combination_count and coupon.combination_count > 2:
            bonus_multiplier = rules.get("combo_bonus_multiplier", 0.1)
            combo_bonus = 1 + (coupon.combination_count - 2) * bonus_multiplier
            base_points *= combo_bonus # Effect: Odds * ComboBonus
            formula_str = f"odds * combo_bonus"
    
    final_points = int(base_points * multiplier)
    
    return final_points, {
        "formula": formula,
        "formula_str": formula_str,
        "base_points": round(base_points, 2),
        "multiplier": multiplier,
        "state": state,
        "final_points": final_points
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
        # Job Status güncelleme yardımcı fonksiyonu
        def update_job_status(status: str, processed=0, saved=0, error=None):
            if not job_id: return
            log_db = SessionLocal()
            try:
                job = log_db.query(WorkerLog).filter(WorkerLog.id == job_id).first()
                if job:
                    job.status = status
                    job.processed_count += processed
                    job.saved_count += saved
                    if error: job.error_message = str(error)
                    if status in ["completed", "failed"]:
                        job.completed_at = datetime.utcnow()
                    log_db.commit()
            except Exception as ex:
                logger.error(f"Job update error: {ex}")
            finally:
                log_db.close()

        if job_id:
            update_job_status("running")

        if target_event_id:
            # Manuel tetiklemede statüsüne bakmaksızın event'i çek
            event = db.query(Event).filter(Event.id == target_event_id).first()
            active_events = [event] if event else []
            
            if not active_events:
                msg = f"Event {target_event_id} veritabanında bulunamadı."
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
                    logger.info(f"User {user.username}: No active enrollments.")
                    continue

                logger.info(f"User {user.username} is enrolled in events: {[e.id for e in user_target_events]}")

                # logger.info(f"Kullanıcı taranıyor: {user.username} (Client ID: {user.client_id})")
                
                # ... fetch history ...

                start_date, end_date = get_date_range()
                bet_history_data = await fetch_bet_history(user.client_id, start_date, end_date)
                
                # Robust parsing
                bets = []
                if isinstance(bet_history_data, dict):
                    bets = bet_history_data.get("Bets", []) or bet_history_data.get("Data", []) or bet_history_data.get("Objects", [])
                elif isinstance(bet_history_data, list):
                    bets = bet_history_data
                
                if not bets:
                    logger.info(f"User {user.username}: No bets found in history.")
                    continue
                
                logger.info(f"User {user.username}: Found {len(bets)} bets raw.")

                    
                for bet_history in bets:
                    user_processed_count += 1
                    bet_id = str(bet_history.get("BetId") or bet_history.get("Id"))
                    if str(bet_id) == "6004498485":
                        logger.info(f"🔍 SERVER DEBUG - RAW BET DATA: {bet_history}")
                    if not bet_id: 
                        logger.debug(f"Skipping bet with no ID")
                        continue

                    
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
                    
                    if mapped_state not in ["won", "lost"]:
                        logger.info(f"Bet {bet_id} skipped: State {mapped_state}")
                        continue



                    # 2. Eligible Event Check
                    eligible_for_events = []
                    
                    # Amount & Selection Count Logic
                    amount = float(bet_history.get("Amount", 0.0) or 0.0) # Stake
                    sel_count = int(bet_history.get("SelectionCount", 1) or bet_history.get("Type", 1)) # Type often means 1/2 (single/multi)

                    for target_event in user_target_events:
                        rules = target_event.rules or {}
                        
                        min_stake = rules.get("min_stake", 0)
                        if amount < min_stake:
                            logger.info(f"   [DEBUG_RULE] Bet {bet_id} SKIPPED Event {target_event.id}: Stake {amount} < Min {min_stake}")
                            continue

                        min_combination = rules.get("min_combination") or rules.get("min_selection_count") or 1
                        if sel_count < int(min_combination):
                            logger.info(f"   [DEBUG_RULE] Bet {bet_id} SKIPPED Event {target_event.id}: Combo {sel_count} < Min {min_combination}")
                            continue

                        max_combination = rules.get("max_combination")
                        if max_combination and sel_count > int(max_combination):
                            logger.info(f"   [DEBUG_RULE] Bet {bet_id} SKIPPED Event {target_event.id}: Combo {sel_count} > Max {max_combination}")
                            continue
                            
                        eligible_for_events.append(target_event)
                        logger.info(f"   [DEBUG_RULE] Bet {bet_id} ELIGIBLE for Event {target_event.id} (Basic Checks Passed)")

                    if not eligible_for_events: 
                         logger.info(f"Bet {bet_id} not eligible for any active events (Stake/SelectCount)")
                         continue



                    # 3. Selections fetching (Lig/Sport Kontrolü)
                    # Rules içinde 'allowed_league_ids' veya 'allowed_sport_ids' varsa detay çekmemiz şart.
                    # Performance: Sadece gerekirse çekelim.
                    
                    details_fetched = False
                    selections = []
                    
                    final_events = []
                    
                    for event in eligible_for_events:
                        # Kural var, detay çekildi mi?
                        # FORCE FETCH always for Frontend Details
                        if not details_fetched:
                            try:
                                await asyncio.sleep(0.3) # Throttle requests
                                sel_data = await fetch_bet_selections(bet_id) # API çağrısı
                                selections = sel_data.get("Selections", [])
                                details_fetched = True
                                
                                # Immediately populate for frontend visibility
                                if selections:
                                    bet_history["Selections"] = selections
                            except Exception as e:
                                logger.error(f"Selections fetch error {bet_id}: {e}")
                                # Skip processing this bet to retry later
                                continue 
                                # If rules require allowed_leagues, verify later.

                        rules = event.rules or {}
                        allowed_leagues = rules.get("allowed_league_ids", [])
                        # allowed_sports eklenebilir: rules.get("allowed_sport_ids", [])
                        
                        # Eğer kural yoksa direkt geçir (But we fetched details above!)
                        if not allowed_leagues:
                            final_events.append(event)
                            continue

                        
                        # Seçimlerin HEPSİ izin verilen liglerde mi?
                        # (Kombine kuponda tek maç bile yasaklı ligdne olsa kupon geçersiz sayılır - Kural tercihi)
                        all_valid = True
                        if not selections:
                            all_valid = False # Detay boşsa geçersiz
                        else:
                            for sel in selections:
                                # API: 'CompetitionId' (18291932)
                                comp_id = sel.get("CompetitionId")
                                if comp_id not in allowed_leagues:
                                    logger.info(f"   [DEBUG_LEAGUE] Bet {bet_id} REJECTED by Event {event.id}: League {comp_id} not in allowed list")
                                    all_valid = False
                                    break
                        
                        if all_valid:
                            final_events.append(event)
                    
                    if not final_events: 
                        logger.info(f"Bet {bet_id} filtered out after league validations.")
                        continue


                    
                    # MERGE Selections into bet_history for Frontend Display
                    if selections:
                         bet_history["Selections"] = selections


                    
                    # 4. Save to DB
                    for event in final_events:
                        # --- Multi-Event Support Refactor ---
                        # 1. Ensure Coupon Exists (Master Record)
                        # 2. Ensure CouponEventResult Exists (Event Specific Record)
                        
                        existing_coupon = db.query(Coupon).filter(Coupon.bet_id == bet_id).first()
                        
                        # Prepare Data
                        price = float(bet_history.get("Price", 1.0) or 1.0)
                        winning_amount = float(bet_history.get("WinAmount") or bet_history.get("Payout") or 0.0)
                        
                        # Parse Date
                        created_str = bet_history.get("Created") or bet_history.get("CreatedLocal")
                        created_dt = datetime.utcnow()
                        if created_str:
                            try:
                                if "+" in created_str: created_str = created_str.split("+")[0]
                                elif "Z" in created_str: created_str = created_str.replace("Z", "")
                                try:
                                    created_dt = datetime.strptime(created_str, "%Y-%m-%dT%H:%M:%S.%f")
                                except ValueError:
                                    created_dt = datetime.strptime(created_str, "%Y-%m-%dT%H:%M:%S")
                            except Exception: pass

                        if not existing_coupon:
                            # Create Master Coupon
                            # We set event_id to the first event we find, just as a primary link (optional)
                            # But logic should rely on CouponEventResult
                            if "Selections" not in bet_history and selections:
                                 bet_history["Selections"] = selections
                            
                            new_coupon = Coupon(
                                client_id=user.client_id, 
                                bet_id=bet_id,
                                event_id=event.id, # Primary event (first one encountered)
                                stake=amount,             
                                odds=price,               
                                combination_count=sel_count,
                                state=mapped_state,       
                                is_live=bool(bet_history.get("IsLive", False)),
                                bet_data=bet_history,
                                created_at=created_dt,
                                winning=winning_amount,
                                is_processed=True,
                                processed_at=datetime.utcnow()
                            )
                            db.add(new_coupon)
                            db.flush() # Get ID
                            existing_coupon = new_coupon
                            user_saved_count += 1
                            logger.info(f"✅ Yeni Kupon Eklendi: {bet_id} | User: {user.username}")
                        else:
                            # Update existing coupon state/winning if changed
                            should_update = False
                            
                            # 1. State/Winning
                            if existing_coupon.state != mapped_state or existing_coupon.winning != winning_amount:
                                existing_coupon.state = mapped_state
                                existing_coupon.winning = winning_amount
                                should_update = True
                            
                            # 2. Selections Backfill (Fix "No Details" issue)
                            if selections:
                                current_data = existing_coupon.bet_data or {}
                                # Check if Missing OR Empty
                                if not current_data.get("Selections"):
                                    logger.info(f"   [DEBUG_UPDATE] Backfilling Selections for Bet {bet_id}")
                                    # bet_history already has Selections merged at this point
                                    existing_coupon.bet_data = bet_history 
                                    should_update = True
                                    
                            if should_update:
                                existing_coupon.processed_at = datetime.utcnow()
                        
                        # --- Event Specific Scoring (CouponEventResult) ---
                        from shared.models.coupon_event_result import CouponEventResult
                        
                        # Calculate Points for THIS event
                        calc_points, calc_details = calculate_points_for_event(existing_coupon, event)
                        
                        # Check existance of result
                        cer = db.query(CouponEventResult).filter(
                            CouponEventResult.coupon_id == existing_coupon.id,
                            CouponEventResult.event_id == event.id
                        ).first()
                        
                        if not cer:
                            logger.info(f"   [DEBUG_MULTI] Creating NEW Result for Event {event.id} | Bet {bet_id}")
                            cer = CouponEventResult(
                                coupon_id=existing_coupon.id,
                                event_id=event.id,
                                is_eligible=True,
                                coupon_state=mapped_state,
                                points_earned=calc_points,
                                points_calculation=calc_details,
                                evaluated_at=datetime.utcnow(),
                                last_checked_at=datetime.utcnow()
                            )
                            db.add(cer)
                            # user_saved_count += 1 # REMOVED: Don't double count. We count on Coupon creation.
                            logger.info(f"   -> Event {event.id} ({event.name}) Puan: {calc_points}")
                        else:
                            # Update score if state changed
                            logger.info(f"   [DEBUG_MULTI] Updating Result for Event {event.id} | Bet {bet_id}")
                            cer.coupon_state = mapped_state
                            cer.points_earned = calc_points
                            cer.points_calculation=calc_details
                            cer.evaluated_at = datetime.utcnow()
                            cer.last_checked_at = datetime.utcnow()


                        # Backwards compatibility: Update generic calculation on Coupon if it matches event_id
                        # (Optional, maybe remove later)
                        if existing_coupon.event_id == event.id:
                            existing_coupon.calculation = calc_points

                # Puanları güncelle (EventParticipant)
                # Query Total points from CouponEventResult
                # NOTE: This must be done BEFORE commit to ensure it is saved!
                for event in user_target_events:
                     total_user_points = db.query(func.sum(CouponEventResult.points_earned)).filter(
                         CouponEventResult.event_id == event.id,
                         CouponEventResult.coupon_id.in_(
                             db.query(Coupon.id).filter(Coupon.client_id == user.client_id)
                         ),
                         # Ensure we only count active/valid results if needed
                         CouponEventResult.is_eligible == True
                     ).scalar() or 0.0
                     
                     enrollment_record = db.query(EventParticipant).filter(
                         EventParticipant.event_id == event.id,
                         EventParticipant.participant_id == user.id
                     ).first()
                     
                     if enrollment_record:
                         enrollment_record.total_points = total_user_points

                db.commit() # Commit batch per user
                         
                # Update job progress after *each user*
                if job_id:
                    update_job_status("running", processed=user_processed_count, saved=user_saved_count)

                if i < len(participants) - 1:
                    await asyncio.sleep(0.05) # Yield to event loop
                    
            except Exception as e:
                logger.error(f"Error processing user {user.username}: {e}")
                import traceback
                traceback.print_exc()
                db.rollback()
        
        if job_id:
             update_job_status("completed")
             
    except Exception as e:
        logger.error(f"Worker process failed: {e}")
        if job_id: update_job_status("failed", error=str(e))
    finally:
        db.close()
