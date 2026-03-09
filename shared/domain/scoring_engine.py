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
from shared.services.betconstruct import fetch_bet_history, fetch_bet_selections, fetch_bet_selections_batch, WorkerCancelledException, set_active_cancel_event, _interruptible_sleep
from shared.models.worker_log import WorkerLog
from shared.models.event import Event
from shared.models.coupon_event_result import CouponEventResult
from shared.models.excluded_bet_cache import ExcludedBetCache

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
    
    # stake_times_odds_raw: çarpanlar sabit (kazanan=1, kaybeden=0)
    if formula == "stake_times_odds_raw":
        multiplier = 1.0 if state == 'won' else 0.0
    elif state == 'won':
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
    elif formula == "stake_times_odds_raw":
        base_points = coupon.stake * truncated_odds
        formula_str = "stake * odds"
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

async def _cancellation_poller(job_id: int, cancel_event: asyncio.Event):
    """Arka planda DB'yi kontrol ederek iptal durumunu sürekli izler."""
    while not cancel_event.is_set():
        check_db = SessionLocal()
        try:
            job_check = check_db.query(WorkerLog).filter(WorkerLog.id == job_id).first()
            if job_check and job_check.status == "cancelled":
                logger.info(f"   [POLLER] Job {job_id} cancelled from DB. Setting cancel event!")
                cancel_event.set()
                return
        except Exception as e:
            logger.error(f"Poller error: {e}")
        finally:
            check_db.close()
        
        await asyncio.sleep(1.0) # Saniyede bir kontrol et

async def process_coupons(target_event_id: Optional[int] = None, job_id: Optional[int] = None, scan_hours: int = 24):
    """
    Kuponları işleyen ana fonksiyon.
    scan_hours: Geriye dönük kaç saatlik periyodu tarayacağını belirler (varsayılan: 24).
    """
    db = SessionLocal()
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
                if status in ["completed", "failed", "cancelled"]:
                    job.completed_at = datetime.utcnow()
                log_db.commit()
        except Exception as ex:
            logger.error(f"Job update error: {ex}")
        finally:
            log_db.close()

    try:
        # 72 saatten eski excluded_bet_cache kayıtlarını temizle
        try:
            cutoff = datetime.utcnow() - timedelta(hours=72)
            deleted_count = db.query(ExcludedBetCache).filter(ExcludedBetCache.created_at < cutoff).delete()
            if deleted_count > 0:
                db.commit()
                logger.info(f"🧹 Excluded bet cache: {deleted_count} eski kayıt temizlendi")
        except Exception as cleanup_err:
            logger.warning(f"Excluded cache cleanup error: {cleanup_err}")
            db.rollback()

        # Eşzamanlılık kilidi: Başka bir worker çalışıyor mu kontrol et
        running_query = db.query(WorkerLog).filter(WorkerLog.status.in_(["running", "pending"]))
        if job_id:
            running_query = running_query.filter(WorkerLog.id != job_id)
            
        running_job = running_query.first()
        if running_job:
            logger.warning(f"⚠️ Başka bir worker zaten çalışıyor (job_id={running_job.id}). Atlanıyor.")
            if job_id:
                update_job_status("failed", error=f"Başka bir worker zaten çalışıyor (ID: {running_job.id})")
            return

        # Cron çağrısında (job_id=None) otomatik WorkerLog oluştur
        if not job_id:
            cron_job = WorkerLog(event_id=target_event_id, status="pending")
            db.add(cron_job)
            db.commit()
            db.refresh(cron_job)
            job_id = cron_job.id
            logger.info(f"📋 Cron worker log oluşturuldu: job_id={job_id}")

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
            
        # Cancellation event ve poller'ı başlat
        cancel_event = asyncio.Event()
        set_active_cancel_event(cancel_event)
        poller_task = None
        if job_id:
            poller_task = asyncio.create_task(_cancellation_poller(job_id, cancel_event))

        for i, user in enumerate(participants):
            user_saved_count = 0
            api_calls_made = False
            try:
                # Cancellation Check anlık
                if cancel_event.is_set():
                    logger.info(f"   [WORKER] Job {job_id} cancelled.")
                    return

                user_enrollments = user_enrollment_map.get(user.id, {})
                user_target_events = [event_info_map[eid]["object"] for eid in user_enrollments if eid in event_info_map]
                
                if not user_target_events:
                    continue

                # OPTİMİZASYON: Tüm geçmişi çekmek yerine (7 gün), sadece son X saati tara!
                # API istek penceresi: event başlangıcından (veya scan_hours öncesinden) itibaren istek at.
                # Böylece katılımdan hemen sonra sonuçlanan kuponlar (örn. 17:21) da gelir; "katılımdan sonra" filtresi
                # aşağıda bet_calc_dt_utc >= p_start_utc ile uygulanıyor.
                # ÖNEMLİ: Event tarihleri TR saati (UTC+3) olarak saklanıyor.
                tr_offset = timedelta(hours=3)
                now_utc = datetime.utcnow()
                now_tr = now_utc + tr_offset
                scan_limit_ago_tr = now_tr - timedelta(hours=scan_hours)
                scan_limit_ago_utc = scan_limit_ago_tr - tr_offset  # UTC'ye çevir
                
                # İstek penceresi = event başlangıçlarından en erken olan (veya scan_hours öncesi). joined_at KULLANMIYORUZ;
                # aksi halde katılımdan hemen sonra sonuçlanan kuponlar API'den hiç gelmez (örn. 16:49 katılım → 17:49'dan istek → 17:21 kuponu kaçar).
                # BC tarafında CalcDateLocal bazen event başlangıcından önce görünebileceği için 1 saat buffer ekliyoruz.
                event_starts_utc = [e.start_date - tr_offset for e in user_target_events]
                earliest_event_utc = min(event_starts_utc) if event_starts_utc else now_utc
                scan_start_utc = max(earliest_event_utc - timedelta(hours=1), scan_limit_ago_utc)
                
                # BETCONSTRUCT TIMEZONE FIX: 
                # Betconstruct API 'CalcStartDateLocal' ve 'CalcEndDateLocal' parametrelerini KENDİ yerel saati (GMT+4) sanıyor.
                # Bizim sunucu ise UTC (GMT+0) kullanıyor. Bu yüzden isteklerimize +4 saat eklemeliyiz 
                # yoksa son 4 saatte yapılan kuponlar hiç taranmaz (gelecekte kalmış gibi görünür).
                bc_offset = timedelta(hours=4)
                
                start_str = (scan_start_utc + bc_offset).strftime("%Y-%m-%dT%H:%M:%SZ")
                end_str = (now_utc + bc_offset + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")

                # Debug log: Katılım tarihi ve scan_start bilgisi
                if user_enrollments:
                    for eid, joined in user_enrollments.items():
                        if joined:
                            logger.info(f"User {user.username} Event {eid}: joined_at={joined} (UTC), scan_start_utc={scan_start_utc} (UTC), scan_start_bc={start_str} (BC Local)")
                
                logger.info(f"User {user.username}: Scanning from {start_str} (BC Local Time) to {end_str}")
                bet_history_data = await fetch_bet_history(user.client_id, start_str, end_str)
                
                bets = []
                if isinstance(bet_history_data, dict):
                    bets = bet_history_data.get("Bets", []) or bet_history_data.get("Data", []) or bet_history_data.get("Objects", [])
                elif isinstance(bet_history_data, list):
                    bets = bet_history_data
                
                logger.info(f"User {user.username}: API returned {len(bets)} bets in date range")
                
                if bets:
                    # Phase 1: Collect eligible bets and determine which need selection detail
                    eligible_bets = []  # (bet_history, bet_id, mapped_state, amount, sel_count, eligible_events)

                    for bet_history in bets:
                        bet_id = str(bet_history.get("BetId") or bet_history.get("Id"))
                        if not bet_id: continue

                        # State Mapping
                        state_name = bet_history.get("StateName", "").lower()
                        state_id = bet_history.get("State", 0)
                        mapped_state = "open"
                        if "won" in state_name: mapped_state = "won"
                        elif "lost" in state_name: mapped_state = "lost"
                        elif "cashout" in state_name: mapped_state = "cashout"
                        elif "returned" in state_name: mapped_state = "returned"
                        
                        if mapped_state == "open":
                            if state_id == 4: mapped_state = "won"
                            elif state_id == 3: mapped_state = "lost"
                            elif state_id == 2 or state_id == 5: mapped_state = "cashout"
                        
                        # Debug: State bilgisini logla
                        raw_calc = bet_history.get("CalcDateLocal") or bet_history.get("CalcDate")
                        if mapped_state not in ["won", "lost"]:
                            logger.info(f"Bet {bet_id}: Skipped - state={mapped_state} (StateName={state_name}, State={state_id}), CalcDateLocal={raw_calc}")
                            continue

                        # Bonus Check: Skip bets made with bonus money, free bets, or attached to a wagering bonus
                        is_bonus_money = bet_history.get("IsBonusMoney", False)
                        wagering_bonus_id = bet_history.get("WageringBonusId")
                        bonus_amount = float(bet_history.get("BonusAmount", 0) or 0)
                        free_bet_amount = float(bet_history.get("FreeBetAmount", 0) or 0)

                        if is_bonus_money or wagering_bonus_id is not None or bonus_amount > 0 or free_bet_amount > 0:
                            logger.info(f"Bet {bet_id} skipped: Identified as bonus/free bet (IsBonusMoney: {is_bonus_money}, WageringBonusId: {wagering_bonus_id}, BonusAmount: {bonus_amount}, FreeBet: {free_bet_amount})")
                            continue

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
                        # CalcDateLocal: Operator/site Türkiye ise API Türkiye saati (GMT+3) döndürüyor; sitede
                        # 17:21 görünüyorsa değer 17:21 TR'dir. BC (GMT+4) sanıp -4 uygularsak 16:21 TR çıkar (1 saat kayma).
                        # Bu yüzden CalcDateLocal'ı TR (GMT+3) kabul edip UTC'ye -3 saat ile çeviriyoruz.
                        calc_local_to_utc_offset = timedelta(hours=-3)  # Turkey (operator) time → UTC
                        bet_calc_dt_utc = None
                        parse_error = None
                        if raw_calc:
                            try:
                                clean_calc = str(raw_calc).split('.')[0].replace("Z", "").split("+")[0]
                                bet_calc_dt_parsed = datetime.strptime(clean_calc, "%Y-%m-%dT%H:%M:%S") if "T" in clean_calc else datetime.strptime(clean_calc, "%Y-%m-%d %H:%M:%S")
                                bet_calc_dt_utc = bet_calc_dt_parsed + calc_local_to_utc_offset
                            except Exception as e:
                                parse_error = str(e)
                                logger.warning(f"Bet {bet_id}: CalcDateLocal parse failed: {raw_calc}, error: {e}")
                        
                        # Eğer parse edilemediyse, kuponu atla (tarih bilgisi olmadan event kontrolü yapamayız)
                        if bet_calc_dt_utc is None:
                            logger.info(f"Bet {bet_id}: Skipping - CalcDateLocal parse failed: {raw_calc}")
                            continue
                        
                        # Event tarihleri TR saati (UTC+3) olarak saklanıyor, UTC'ye çevir
                        tr_offset = timedelta(hours=3)
                        
                        # Debug: Parse edilen tarihi logla - DETAYLI SAAT BİLGİSİ (17:50:56 kuponu için)
                        bet_calc_bc_local = bet_calc_dt_utc + timedelta(hours=4)  # BC Local Time (GMT+4)
                        bet_calc_tr_local = bet_calc_dt_utc + tr_offset  # TR Local Time (UTC+3)
                        logger.info(f"Bet {bet_id}: CalcDateLocal={raw_calc}, parsed_utc={bet_calc_dt_utc.strftime('%Y-%m-%d %H:%M:%S')}, "
                                  f"BC_Local={bet_calc_bc_local.strftime('%Y-%m-%d %H:%M:%S')}, "
                                  f"TR_Local={bet_calc_tr_local.strftime('%Y-%m-%d %H:%M:%S')}, state={mapped_state}")
                        for target_event in user_target_events:
                            joined_at = user_enrollments.get(target_event.id)
                            # Event tarihlerini UTC'ye çevir
                            event_start_utc = target_event.start_date - tr_offset
                            event_end_utc = target_event.end_date - tr_offset
                            # ÖNEMLİ: joined_at zaten UTC olarak saklanıyor (func.now() kullanılıyor), offset çıkarmamalıyız!
                            joined_at_utc = joined_at if joined_at else event_start_utc
                            p_start_utc = max(event_start_utc, joined_at_utc)
                            
                            # DETAYLI TARİH LOGLAMA - 17:50:56 kuponu için
                            logger.info(f"Bet {bet_id} Event {target_event.id}: DATE CHECK - "
                                      f"bet_calc_utc={bet_calc_dt_utc.strftime('%Y-%m-%d %H:%M:%S')} (BC_Local: {bet_calc_bc_local.strftime('%Y-%m-%d %H:%M:%S')}, TR_Local: {bet_calc_tr_local.strftime('%Y-%m-%d %H:%M:%S')}), "
                                      f"p_start_utc={p_start_utc.strftime('%Y-%m-%d %H:%M:%S')} (TR: {(p_start_utc + tr_offset).strftime('%Y-%m-%d %H:%M:%S')}), "
                                      f"event_start_utc={event_start_utc.strftime('%Y-%m-%d %H:%M:%S')} (TR: {(event_start_utc + tr_offset).strftime('%Y-%m-%d %H:%M:%S')}), "
                                      f"event_end_utc={event_end_utc.strftime('%Y-%m-%d %H:%M:%S')} (TR: {(event_end_utc + tr_offset).strftime('%Y-%m-%d %H:%M:%S')}), "
                                      f"joined_at={joined_at}")
                            
                            # UTC'ye normalize edilmiş tarihlerle karşılaştır
                            if bet_calc_dt_utc < p_start_utc:
                                logger.info(f"Bet {bet_id} Event {target_event.id}: Skipped - bet_calc_dt_utc ({bet_calc_dt_utc}) < p_start_utc ({p_start_utc}) [joined_at={joined_at}]")
                                continue
                            if bet_calc_dt_utc > event_end_utc:
                                logger.info(f"Bet {bet_id} Event {target_event.id}: Skipped - bet_calc_dt_utc ({bet_calc_dt_utc}) > event_end_utc ({event_end_utc})")
                                continue

                            rules = target_event.rules or {}
                            min_stake = rules.get("min_stake", 0)
                            if amount < min_stake:
                                logger.info(f"Bet {bet_id} Event {target_event.id}: Skipped - amount ({amount}) < min_stake ({min_stake})")
                                continue
                            min_sel = rules.get("min_combination") or rules.get("min_selection_count") or 1
                            if sel_count < int(min_sel):
                                logger.info(f"Bet {bet_id} Event {target_event.id}: Skipped - sel_count ({sel_count}) < min_combination ({min_sel})")
                                continue
                            
                            logger.info(f"Bet {bet_id} Event {target_event.id}: ELIGIBLE - bet_calc_dt_utc={bet_calc_dt_utc}, amount={amount}, sel_count={sel_count}, state={mapped_state}")
                            eligible_for_events.append(target_event)

                        if not eligible_for_events: continue

                        # Kaybeden çarpanı 0 ise kaybeden kuponları atla (gereksiz API çağrısı yapma)
                        if mapped_state == "lost":
                            all_zero = all(float(getattr(ev, 'loss_point_multiplier', 0)) == 0 for ev in eligible_for_events)
                            if all_zero:
                                logger.info(f"Bet {bet_id}: Skipped - lost and loss_point_multiplier=0 for all eligible events (no points for losses)")
                                continue

                        # PRE-FILTER: Tekli kuponlarda Price < min_odd ise selection çekmeye gerek yok
                        if sel_count == 1:
                            price = float(bet_history.get("Price", 0) or 0)
                            all_excluded_by_odds = True
                            for ev in eligible_for_events:
                                ev_min_odd = float((ev.rules or {}).get("min_odd", 0) or 0)
                                if ev_min_odd <= 0 or price >= ev_min_odd:
                                    all_excluded_by_odds = False
                                    break
                            if all_excluded_by_odds:
                                continue

                        # Extract created date just for DB storage
                        raw_created = bet_history.get("CreatedAt") or bet_history.get("Created")
                        bet_created_dt_utc = bet_calc_dt_utc
                        if raw_created:
                            try:
                                clean_created = str(raw_created).split('.')[0].replace("Z", "").split("+")[0]
                                bet_created_dt_parsed = datetime.strptime(clean_created, "%Y-%m-%dT%H:%M:%S") if "T" in clean_created else datetime.strptime(clean_created, "%Y-%m-%d %H:%M:%S")
                                bet_created_dt_utc = bet_created_dt_parsed + calc_local_to_utc_offset
                            except: pass

                        eligible_bets.append((bet_history, bet_id, mapped_state, amount, sel_count, eligible_for_events, bet_created_dt_utc, bet_calc_dt_utc))

                    # Phase 2: Batch fetch selection details
                    # Önce DB'deki mevcut kuponların selections verisini kontrol et
                    bet_ids_needing_fetch = []
                    selections_cache = {}
                    
                    # Excluded bet cache'teki bet_id'leri toplu çek
                    all_eligible_bids = [bid for _, bid, *_ in eligible_bets]
                    
                    import collections
                    excluded_bids_map = collections.defaultdict(set)
                    
                    if all_eligible_bids:
                        for row in db.query(ExcludedBetCache.bet_id, ExcludedBetCache.event_id).filter(
                            ExcludedBetCache.bet_id.in_(all_eligible_bids)
                        ).all():
                            excluded_bids_map[row.bet_id].add(row.event_id)
                    
                    for bet_hist, bid, mapped_state, amount, sel_count, eligible_for_events, bet_created_dt, bet_calc_dt in eligible_bets:
                        # Bu kupon şu an girebileceği TÜM eventler için daha önceden exclude edilmiş mi?
                        required_event_ids = set(ev.id for ev in eligible_for_events)
                        already_excluded_for = excluded_bids_map.get(bid, set())
                        
                        # Eğer bu kuponun aday olduğu TÜM eventler için önceden denenip çöpe atıldığı cache'te varsa -> Atla
                        if required_event_ids and required_event_ids.issubset(already_excluded_for):
                            continue
                            
                        existing = db.query(Coupon).filter(Coupon.bet_id == bid).first()
                        if existing and existing.bet_data and existing.bet_data.get("Selections"):
                            # DB'de zaten detay var, API'ye istek atma
                            selections_cache[bid] = {"Selections": existing.bet_data["Selections"]}
                        else:
                            bet_ids_needing_fetch.append(bid)
                    
                    if bet_ids_needing_fetch:
                        logger.info(f"User {user.username}: Batch fetching {len(bet_ids_needing_fetch)} bet selections (skipped {len(eligible_bets) - len(bet_ids_needing_fetch)} cached)")
                        api_calls_made = True
                        await _interruptible_sleep(1.0)  # History -> Selection arası 1sn (rate limit)
                        async with httpx.AsyncClient(timeout=30) as http_client:
                            fetched = await fetch_bet_selections_batch(
                                bet_ids_needing_fetch, http_client
                            )
                            selections_cache.update(fetched)
                    else:
                        logger.info(f"User {user.username}: All {len(eligible_bets)} selections already cached, no API calls needed")

                    # Phase 3: Process each bet with cached selections
                    for bet_history, bet_id, mapped_state, amount, sel_count, eligible_for_events, bet_created_dt_utc, bet_calc_dt_utc in eligible_bets:
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
                        skipped_events_due_to_missing_data = set()

                        for event in eligible_for_events:
                            rules = event.rules or {}
                            allowed_leagues = rules.get("allowed_league_ids") or []
                            min_odd = float(rules.get("min_odd", 0) or 0)
                            
                            all_valid = True
                            is_missing_selections = False

                            # min_odd kontrolü: Kombine kuponlarda her seçimin oranı min_odd'dan büyük olmalı
                            if min_odd > 0:
                                if not selections_for_bet:
                                    logger.info(f"Bet {bet_id} skipped for event {event.id}: Missing selections while min_odd > 0 is required.")
                                    all_valid = False
                                    is_missing_selections = True
                                else:
                                    for sel in selections_for_bet:
                                        sel_price = float(sel.get("Price", 0) or sel.get("Odds", 0) or sel.get("Coefficient", 0) or 0)
                                        if sel_price < min_odd:
                                            logger.info(f"Bet {bet_id} excluded from event {event.id}: selection odds {sel_price} < min_odd {min_odd}")
                                            all_valid = False
                                            break

                            if allowed_leagues and all_valid:
                                if not selections_for_bet:
                                    # Detay çekilemedi — kaybeden ve 0 puan ise kabul et, değilse atla (sonraki çalışmada tekrar denenecek)
                                    if mapped_state == "lost" and float(getattr(event, 'loss_point_multiplier', 0)) == 0:
                                        all_valid = True
                                    else:
                                        logger.info(f"Bet {bet_id} skipped for event {event.id}: Missing selections while allowed_leagues requires checking.")
                                        all_valid = False
                                        is_missing_selections = True
                                else:
                                    all_valid = all(str(s.get("CompetitionId")) in [str(lid) for lid in allowed_leagues] for s in selections_for_bet)
                            
                            if all_valid: 
                                final_events.append(event)
                            elif is_missing_selections:
                                # Mark as skipped entirely instead of simply excluded so we DON'T add to ExcludedBetCache
                                skipped_events_due_to_missing_data.add(event.id)

                        # final_events boş olsa bile, mevcut kupona selections ekle
                        if not final_events and not skipped_events_due_to_missing_data:
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

                        # Hangi eventlerden elendiyse, onları ExcludedCache'e kaydet
                        excluded_events = [ev for ev in eligible_for_events if ev not in final_events and ev.id not in skipped_events_due_to_missing_data]
                        if excluded_events:
                            logger.info(f"DEBUG: Bet {bet_id} excluded from {len(excluded_events)} events. Attempting to save to cache...")
                        
                        for ex_ev in excluded_events:
                            try:
                                exists = db.query(ExcludedBetCache).filter(
                                    ExcludedBetCache.bet_id == bet_id, 
                                    ExcludedBetCache.event_id == ex_ev.id
                                ).first()
                                if not exists:
                                    db.add(ExcludedBetCache(bet_id=bet_id, client_id=user.client_id, event_id=ex_ev.id))
                                    logger.info(f"DEBUG: Bet {bet_id} added to DB session for Event {ex_ev.id}")
                                else:
                                    logger.info(f"DEBUG: Bet {bet_id} already exists in DB for Event {ex_ev.id}")
                            except Exception as cache_err:
                                logger.warning(f"DEBUG: Bet {bet_id} (Event {ex_ev.id}) cache save failed: {cache_err}")
                                db.rollback()
                        
                        try:
                            if excluded_events:
                                db.commit()
                                logger.info(f"DEBUG: DB Commit SUCCESS for {len(excluded_events)} events for bet {bet_id}")
                        except Exception as e:
                            logger.warning(f"DEBUG: Bet {bet_id} excluded events commit failed: {e}")
                            db.rollback()

                        if not final_events:
                            logger.info(f"Bet {bet_id}: Skipped - no final_events after selections validation (had {len(eligible_for_events)} eligible events initially, selections_count={len(selections_for_bet)})")
                            continue

                        # Save to DB — her kupon bağımsız olarak kaydedilir
                        try:
                            existing_coupon = db.query(Coupon).filter(Coupon.bet_id == bet_id).first()
                            price = float(bet_history.get("Price", 1.0) or 1.0)
                            winning_amount = float(bet_history.get("WinAmount") or bet_history.get("Payout") or 0.0)

                            if not existing_coupon:
                                logger.info(f"Bet {bet_id}: Creating NEW coupon for events {[e.id for e in final_events]}")
                                new_coupon = Coupon(
                                    client_id=user.client_id, bet_id=bet_id, event_id=final_events[0].id,
                                    stake=amount, odds=price, combination_count=sel_count, state=mapped_state,
                                    is_live=bool(bet_history.get("IsLive", False)), bet_data=bet_history,
                                    created_at=bet_calc_dt_utc, winning=winning_amount, is_processed=True, processed_at=datetime.utcnow()
                                )
                                db.add(new_coupon)
                                db.flush()
                                existing_coupon = new_coupon
                                user_saved_count += 1
                            else:
                                logger.info(f"Bet {bet_id}: Existing coupon found (id={existing_coupon.id}), updating state/winning if needed")
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
                                    logger.info(f"Bet {bet_id} Event {event.id}: Creating NEW CouponEventResult, points={calc_points}")
                                    db.add(CouponEventResult(
                                        coupon_id=existing_coupon.id, event_id=event.id, is_eligible=True,
                                        coupon_state=mapped_state, points_earned=calc_points, points_calculation=calc_details,
                                        evaluated_at=datetime.utcnow(), last_checked_at=datetime.utcnow()
                                    ))
                                else:
                                    logger.info(f"Bet {bet_id} Event {event.id}: Updating existing CouponEventResult (id={cer.id}), points={calc_points}")
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
            except WorkerCancelledException as wc:
                logger.info(f"   [WORKER] Interrupted by cancellation: {wc}")
                db.rollback()
                return
            except Exception as e:
                logger.error(f"Error user {user.username}: {e}")
                db.rollback()
            finally:
                if job_id and not cancel_event.is_set():
                    update_job_status("running", processed=1, saved=user_saved_count)
                
                # Kullanıcılar arası 4sn bekleme (2dk pencerede önceki user istekleri temizlensin)
                if not cancel_event.is_set():
                    slept = 0.0
                    while slept < 4.0:
                        if cancel_event.is_set():
                            logger.info(f"   [WORKER] Job {job_id} cancelled during user delay.")
                            return
                        await asyncio.sleep(0.5)
                        slept += 0.5

        if job_id: update_job_status("completed")
    except Exception as e:
        logger.error(f"Worker failed: {e}")
        if job_id: update_job_status("failed", error=str(e))
    finally:
        db.close()
        # Poller task'i temizle
        if 'poller_task' in locals() and poller_task:
            poller_task.cancel()
