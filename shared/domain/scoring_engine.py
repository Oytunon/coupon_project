import asyncio
import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
import math

from sqlalchemy import func
from shared.database import SessionLocal
from shared.models.coupon import Coupon
from shared.models.participant import Participant
from shared.models.enrollment import EventParticipant
from shared.services.betconstruct import fetch_bet_history, fetch_bet_selections, fetch_bet_selections_batch
from shared.models.worker_log import WorkerLog
from shared.models.event import Event
from shared.models.coupon_event_result import CouponEventResult

logger = logging.getLogger(__name__)

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
    
    if state == 'won':
        multiplier = event.won_point_multiplier
    elif state == 'lost':
        multiplier = event.loss_point_multiplier
    else:
        multiplier = 0.0
    
    truncated_odds = math.floor(coupon.odds * 100) / 100.0
    
    base_points = truncated_odds
    formula_str = "odds"

    if formula == "stake_times_odds":
        base_points = (coupon.stake * truncated_odds) / 10
        formula_str = "(stake * odds) / 10"
    elif formula == "net_profit_multiplier":
        base_points = max(0.0, (coupon.stake * truncated_odds) - coupon.stake)
        formula_str = "(stake * odds) - stake"
    
    final_points = math.floor(base_points * multiplier * 100) / 100.0
    
    return final_points, {
        "formula": formula,
        "formula_str": formula_str,
        "base_points": round(base_points, 4),
        "multiplier": multiplier,
        "state": state,
        "final_points": final_points,
        "truncated_odds": truncated_odds
    }

async def process_coupons(target_event_id: Optional[int] = None, job_id: Optional[int] = None):
    """
    Kuponları işleyen ana fonksiyon.
    """
    db = SessionLocal()
    try:
        # Eşzamanlılık kilidi: Başka bir worker çalışıyor mu kontrol et
        running_job = db.query(WorkerLog).filter(WorkerLog.status == "running").first()
        if running_job:
            logger.warning(f"⚠️ Başka bir worker zaten çalışıyor (job_id={running_job.id}). Atlanıyor.")
            return

        # Cron çağrısında (job_id=None) otomatik WorkerLog oluştur
        if not job_id:
            cron_job = WorkerLog(event_id=target_event_id, status="pending")
            db.add(cron_job)
            db.commit()
            db.refresh(cron_job)
            job_id = cron_job.id
            logger.info(f"📋 Cron worker log oluşturuldu: job_id={job_id}")

        def update_job_status(status: str, processed=0, saved=0, error=None, total=0):
            if not job_id: return
            log_db = SessionLocal()
            try:
                job = log_db.query(WorkerLog).filter(WorkerLog.id == job_id).first()
                if job:
                    job.status = status
                    job.processed_count += processed
                    job.saved_count += saved
                    if total > 0:
                        job.total_count = total
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
            event = db.query(Event).filter(Event.id == target_event_id).first()
            active_events = [event] if event else []
            if not active_events:
                msg = f"Event {target_event_id} veritabanında bulunamadı."
                update_job_status("failed", error=msg)
                return
        else:
            from shared.domain.rules_validator import get_active_events
            active_events = get_active_events(db=db)

        if not active_events:
            if job_id: update_job_status("completed")
            return

        active_event_ids = [e.id for e in active_events]
        enrollments = db.query(EventParticipant).filter(
            EventParticipant.event_id.in_(active_event_ids)
        ).all()
        
        participant_ids = list(set(e.participant_id for e in enrollments))
        if not participant_ids:
            if job_id: update_job_status("completed")
            return

        participants = db.query(Participant).filter(Participant.id.in_(participant_ids)).all()
        
        user_enrollment_map = {}
        for enr in enrollments:
            if enr.participant_id not in user_enrollment_map:
                user_enrollment_map[enr.participant_id] = {}
            user_enrollment_map[enr.participant_id][enr.event_id] = enr.joined_at

        event_info_map = {}
        for e in active_events:
            event_info_map[e.id] = {
                "object": e,
                "name": e.name,
                "rules": e.rules
            }

        if job_id:
            update_job_status("running", total=len(participants))

        for i, user in enumerate(participants):
            user_saved_count = 0
            api_calls_made = False
            try:
                # Cancellation Check
                if job_id and i % 3 == 0:
                    check_db = SessionLocal()
                    try:
                        job_check = check_db.query(WorkerLog).filter(WorkerLog.id == job_id).first()
                        if job_check and job_check.status == "cancelled":
                            logger.info(f"   [WORKER] Job {job_id} cancelled.")
                            return
                    finally:
                        check_db.close()

                user_enrollments = user_enrollment_map.get(user.id, {})
                user_target_events = [event_info_map[eid]["object"] for eid in user_enrollments if eid in event_info_map]
                
                if not user_target_events:
                    continue

                # OPTİMİZASYON: Tüm geçmişi çekmek yerine (7 gün), sadece son 48 saati tara!
                # Eğer event henüz yeni başladıysa (48 saatten daha yeniyse), event başlangıcından itibaren tara.
                forty_eight_hours_ago = datetime.utcnow() - timedelta(hours=48)
                user_p_starts = []
                for event in user_target_events:
                    joined_at = user_enrollments.get(event.id)
                    p_start = max(event.start_date, joined_at or event.start_date)
                    user_p_starts.append(p_start)
                
                # scan_start = Eventin başladığı saat ile 48 saat öncesinden hangisi DAHA GÜNCELSE (daha büyükse) onu al.
                # (Örn: Event 5 gün önce başladıysa 48 saat öncesini al. Event 10 saat önce başladıysa 10 saat öncesini al.)
                scan_start = max(min(user_p_starts), forty_eight_hours_ago) if user_p_starts else forty_eight_hours_ago
                start_str = scan_start.strftime("%Y-%m-%dT%H:%M:%SZ")
                end_str = (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")

                logger.info(f"User {user.username}: Scanning from {start_str}")
                bet_history_data = await fetch_bet_history(user.client_id, start_str, end_str)
                
                bets = []
                if isinstance(bet_history_data, dict):
                    bets = bet_history_data.get("Bets", []) or bet_history_data.get("Data", []) or bet_history_data.get("Objects", [])
                elif isinstance(bet_history_data, list):
                    bets = bet_history_data
                
                if bets:
                    # Phase 1: Collect eligible bets and determine which need selection detail
                    eligible_bets = []  # (bet_history, bet_id, mapped_state, amount, sel_count, eligible_events)

                    for bet_history in bets:
                        bet_id = str(bet_history.get("BetId") or bet_history.get("Id"))
                        if not bet_id: continue

                        # State Mapping
                        state_name = bet_history.get("StateName", "").lower()
                        mapped_state = "open"
                        if "won" in state_name: mapped_state = "won"
                        elif "lost" in state_name: mapped_state = "lost"
                        elif "cashout" in state_name: mapped_state = "cashout"
                        elif "returned" in state_name: mapped_state = "returned"
                        
                        if mapped_state == "open":
                            sid = bet_history.get("State", 0)
                            if sid == 4: mapped_state = "won"
                            elif sid == 3: mapped_state = "lost"
                            elif sid == 2 or sid == 5: mapped_state = "cashout"
                        
                        if mapped_state not in ["won", "lost"]: continue

                        # Strict Type Whitelist (Only Single and Multiple allowed)
                        type_val = bet_history.get("Type", 1)
                        type_name = str(bet_history.get("TypeName", "")).lower()
                        
                        allowed_int_types = [1, 2]
                        allowed_str_types = ["single", "multiple"]
                        
                        if isinstance(type_val, int) and type_val not in allowed_int_types:
                            continue
                        if isinstance(type_val, str):
                            if type_val.lower() not in allowed_str_types and type_val not in ["1", "2"]:
                                continue
                        if type_name and type_name not in allowed_str_types:
                            continue

                        # Rules Check
                        amount = float(bet_history.get("Amount", 0.0) or 0.0)
                        
                        try:
                            sel_count = int(bet_history.get("SelectionCount") or type_val or 1)
                        except (ValueError, TypeError):
                            sel_count = 1
                        
                        eligible_for_events = []
                        raw_calc = bet_history.get("CalcDateLocal") or bet_history.get("CalcDate")
                        bet_calc_dt = datetime.utcnow()
                        if raw_calc:
                            try:
                                clean_calc = str(raw_calc).split('.')[0].replace("Z", "").split("+")[0]
                                bet_calc_dt = datetime.strptime(clean_calc, "%Y-%m-%dT%H:%M:%S") if "T" in clean_calc else datetime.strptime(clean_calc, "%Y-%m-%d %H:%M:%S")
                            except: pass

                        for target_event in user_target_events:
                            joined_at = user_enrollments.get(target_event.id)
                            p_start = max(target_event.start_date, joined_at or target_event.start_date)
                            if bet_calc_dt < p_start: continue

                            rules = target_event.rules or {}
                            if amount < rules.get("min_stake", 0): continue
                            min_sel = rules.get("min_combination") or rules.get("min_selection_count") or 1
                            if sel_count < int(min_sel): continue
                            
                            eligible_for_events.append(target_event)

                        if not eligible_for_events: continue

                        # Kaybeden çarpanı 0 ise kaybeden kuponları atla (gereksiz API çağrısı yapma)
                        if mapped_state == "lost":
                            all_zero = all(float(getattr(ev, 'loss_point_multiplier', 0)) == 0 for ev in eligible_for_events)
                            if all_zero:
                                continue

                        # Extract created date just for DB storage
                        raw_created = bet_history.get("CreatedAt") or bet_history.get("Created")
                        bet_created_dt = bet_calc_dt
                        if raw_created:
                            try:
                                clean_created = str(raw_created).split('.')[0].replace("Z", "").split("+")[0]
                                bet_created_dt = datetime.strptime(clean_created, "%Y-%m-%dT%H:%M:%S") if "T" in clean_created else datetime.strptime(clean_created, "%Y-%m-%d %H:%M:%S")
                            except: pass

                        eligible_bets.append((bet_history, bet_id, mapped_state, amount, sel_count, eligible_for_events, bet_created_dt, bet_calc_dt))

                    # Phase 2: Batch fetch selection details
                    # Önce DB'deki mevcut kuponların selections verisini kontrol et
                    bet_ids_needing_fetch = []
                    selections_cache = {}
                    
                    for bet_hist, bid, *_ in eligible_bets:
                        existing = db.query(Coupon).filter(Coupon.bet_id == bid).first()
                        if existing and existing.bet_data and existing.bet_data.get("Selections"):
                            # DB'de zaten detay var, API'ye istek atma
                            selections_cache[bid] = {"Selections": existing.bet_data["Selections"]}
                        else:
                            bet_ids_needing_fetch.append(bid)
                    
                    if bet_ids_needing_fetch:
                        logger.info(f"User {user.username}: Batch fetching {len(bet_ids_needing_fetch)} bet selections (skipped {len(eligible_bets) - len(bet_ids_needing_fetch)} cached)")
                        api_calls_made = True
                        async with httpx.AsyncClient(timeout=30) as http_client:
                            fetched = await fetch_bet_selections_batch(
                                bet_ids_needing_fetch, http_client
                            )
                            selections_cache.update(fetched)
                    else:
                        logger.info(f"User {user.username}: All {len(eligible_bets)} selections already cached, no API calls needed")

                    # Phase 3: Process each bet with cached selections
                    for bet_history, bet_id, mapped_state, amount, sel_count, eligible_for_events, bet_created_dt, bet_calc_dt in eligible_bets:
                        # Merge selections into bet_history for persistence
                        selections_for_bet = []
                        if bet_history.get("Selections"):
                            selections_for_bet = bet_history["Selections"]
                        elif bet_id in selections_cache:
                            sel_data = selections_cache.get(bet_id, {})
                            selections_for_bet = sel_data.get("Selections", [])
                            # bet_history'ye ekle → DB'ye kaydedilecek
                            bet_history["Selections"] = selections_for_bet

                        final_events = []

                        for event in eligible_for_events:
                            rules = event.rules or {}
                            allowed_leagues = rules.get("allowed_league_ids") or []
                            min_odd = float(rules.get("min_odd", 0) or 0)
                            
                            all_valid = True

                            # min_odd kontrolü: Kombine kuponlarda her seçimin oranı min_odd'dan büyük olmalı
                            if min_odd > 0 and selections_for_bet:
                                for sel in selections_for_bet:
                                    sel_price = float(sel.get("Price", 0) or 0)
                                    if sel_price < min_odd:
                                        logger.info(f"Bet {bet_id} excluded from event {event.id}: selection odds {sel_price} < min_odd {min_odd}")
                                        all_valid = False
                                        break

                            if allowed_leagues and all_valid:
                                if not selections_for_bet:
                                    # Detay çekilemedi — kaybeden ve 0 puan ise kabul et, değilse atla (sonraki çalışmada tekrar denenecek)
                                    all_valid = (mapped_state == "lost" and float(getattr(event, 'loss_point_multiplier', 0)) == 0)
                                else:
                                    all_valid = all(str(s.get("CompetitionId")) in [str(lid) for lid in allowed_leagues] for s in selections_for_bet)
                            
                            if all_valid: final_events.append(event)

                        if not final_events:
                            # final_events boş olsa bile, mevcut kupona selections ekle
                            try:
                                existing_coupon = db.query(Coupon).filter(Coupon.bet_id == bet_id).first()
                                if existing_coupon and selections_for_bet and existing_coupon.bet_data:
                                    current_data = existing_coupon.bet_data or {}
                                    if not current_data.get("Selections"):
                                        current_data["Selections"] = selections_for_bet
                                        existing_coupon.bet_data = current_data
                                        from sqlalchemy.orm.attributes import flag_modified
                                        flag_modified(existing_coupon, "bet_data")
                            except Exception as sel_err:
                                logger.warning(f"Bet {bet_id}: selections update failed: {sel_err}")
                            continue

                        # Save to DB — her kupon bağımsız olarak kaydedilir
                        try:
                            existing_coupon = db.query(Coupon).filter(Coupon.bet_id == bet_id).first()
                            price = float(bet_history.get("Price", 1.0) or 1.0)
                            winning_amount = float(bet_history.get("WinAmount") or bet_history.get("Payout") or 0.0)

                            if not existing_coupon:
                                new_coupon = Coupon(
                                    client_id=user.client_id, bet_id=bet_id, event_id=final_events[0].id,
                                    stake=amount, odds=price, combination_count=sel_count, state=mapped_state,
                                    is_live=bool(bet_history.get("IsLive", False)), bet_data=bet_history,
                                    created_at=bet_calc_dt, winning=winning_amount, is_processed=True, processed_at=datetime.utcnow()
                                )
                                db.add(new_coupon)
                                db.flush()
                                existing_coupon = new_coupon
                                user_saved_count += 1
                            else:
                                if existing_coupon.state != mapped_state or existing_coupon.winning != winning_amount:
                                    existing_coupon.state = mapped_state
                                    existing_coupon.winning = winning_amount
                                    existing_coupon.processed_at = datetime.utcnow()
                                # Mevcut kupona selections ekle (Detay yok → Detay var)
                                if selections_for_bet and existing_coupon.bet_data:
                                    current_data = existing_coupon.bet_data or {}
                                    if not current_data.get("Selections"):
                                        current_data["Selections"] = selections_for_bet
                                        existing_coupon.bet_data = current_data
                                        from sqlalchemy.orm.attributes import flag_modified
                                        flag_modified(existing_coupon, "bet_data")

                            for event in final_events:
                                calc_points, calc_details = calculate_points_for_event(existing_coupon, event)
                                cer = db.query(CouponEventResult).filter(CouponEventResult.coupon_id == existing_coupon.id, CouponEventResult.event_id == event.id).first()
                                if not cer:
                                    db.add(CouponEventResult(
                                        coupon_id=existing_coupon.id, event_id=event.id, is_eligible=True,
                                        coupon_state=mapped_state, points_earned=calc_points, points_calculation=calc_details,
                                        evaluated_at=datetime.utcnow(), last_checked_at=datetime.utcnow()
                                    ))
                                else:
                                    cer.coupon_state = mapped_state
                                    cer.points_earned = calc_points
                                    cer.points_calculation = calc_details
                                    cer.last_checked_at = datetime.utcnow()
                        except Exception as bet_err:
                            logger.error(f"Bet {bet_id} save failed: {bet_err}")
                            db.rollback()
                            continue

                    logger.info(f"User {user.username}: {len(bets)} bets fetched, {len(eligible_bets)} eligible, {user_saved_count} new saved")

                # Update Participant Totals
                for event in user_target_events:
                    total_points = db.query(func.sum(CouponEventResult.points_earned)).filter(
                        CouponEventResult.event_id == event.id,
                        CouponEventResult.coupon_id.in_(db.query(Coupon.id).filter(Coupon.client_id == user.client_id)),
                        CouponEventResult.is_eligible == True
                    ).scalar() or 0.0
                    
                    enrollment = db.query(EventParticipant).filter(EventParticipant.event_id == event.id, EventParticipant.participant_id == user.id).first()
                    if enrollment: enrollment.total_points = total_points

                db.commit()
            except Exception as e:
                logger.error(f"Error user {user.username}: {e}")
                db.rollback()
            finally:
                if job_id:
                    update_job_status("running", processed=1, saved=user_saved_count)
                
                await asyncio.sleep(4.0)  # Kullanıcılar arası sabit bekleme süresi

        if job_id: update_job_status("completed")
    except Exception as e:
        logger.error(f"Worker failed: {e}")
        if job_id: update_job_status("failed", error=str(e))
    finally:
        db.close()
