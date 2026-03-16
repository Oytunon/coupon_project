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
from shared.services.betconstruct import fetch_bet_report, fetch_bet_selections_batch, WorkerCancelledException, set_active_cancel_event, _interruptible_sleep
from shared.models.worker_log import WorkerLog
from shared.models.event import Event
from shared.models.coupon_event_result import CouponEventResult
from shared.models.excluded_bet_cache import ExcludedBetCache
from shared.models.event_lost_coupon import EventLostCoupon

logger = logging.getLogger(__name__)

# Stale job sonrası cooldown - rate limit toparlanması için yeni job hemen başlamasın
_stale_cooldown_until = None

def _is_multi_coupon(coupon: Coupon) -> bool:
    """Kupon multi/kombine mi kontrol eder."""
    if (coupon.combination_count or 0) > 1:
        return True
    bet_data = coupon.bet_data or {}
    type_val = bet_data.get("Type", 1)
    type_name = str(bet_data.get("TypeName", "")).lower()
    if type_val in (2, 3):
        return True
    if type_name in ("multiple", "combo", "accumulator", "kombine", "parlay"):
        return True
    return False


def _has_asian_selection(coupon: Coupon) -> bool:
    """Kupon Asya bahis seçimi içeriyor mu (Total Goals Asian vb.)."""
    bet_data = coupon.bet_data or {}
    selections = bet_data.get("Selections") or bet_data.get("BetSelections") or []
    for sel in selections:
        market = str(sel.get("MarketName") or sel.get("DisplayMarketName") or "").lower()
        if "asian" in market:
            return True
    return False


def _has_returned_selection(coupon: Coupon) -> bool:
    """Kupon iade (Returned) seçim içeriyor mu (State 2)."""
    bet_data = coupon.bet_data or {}
    selections = bet_data.get("Selections") or bet_data.get("BetSelections") or []
    for sel in selections:
        sel_state = sel.get("State")
        sel_state_name = str(sel.get("StateName") or "").lower()
        if sel_state == 2 or "returned" in sel_state_name:
            return True
    return False


def calculate_points_for_event(
    coupon: Coupon, 
    event: Event
) -> Tuple[float, dict]:
    """
    Event'in scoring formula'sına göre puan hesaplar.
    Multi kuponlarda Asya veya iade (Returned) varsa: puan = WinningAmount.
    """
    rules = event.rules or {}
    formula = rules.get("scoring_formula", "simple")
    state = coupon.state.lower()
    
    # Multi + (Asya veya iade) + kazanç: puan = WinningAmount
    use_winning_amount = (
        state == 'won'
        and _is_multi_coupon(coupon)
        and (_has_asian_selection(coupon) or _has_returned_selection(coupon))
    )
    if use_winning_amount:
        winning_amount = coupon.winning or 0.0
        if winning_amount <= 0:
            bet_data = coupon.bet_data or {}
            winning_amount = float(
                bet_data.get("WinningAmount") or bet_data.get("WinAmount") or bet_data.get("Payout") or 0
            ) or 0.0
        if winning_amount > 0:
            final_points = round(winning_amount, 2)
            formula_str = "WinningAmount (multi+Asian/Returned)"
            return final_points, {
                "formula": formula,
                "formula_str": formula_str,
                "base_points": round(winning_amount, 4),
                "multiplier": 1.0,
                "state": state,
                "final_points": final_points,
                "truncated_odds": round(coupon.odds, 3),
            }
    
    # stake_times_odds_raw: çarpanlar sabit (kazanan=1, kaybeden=0)
    if formula == "stake_times_odds_raw":
        multiplier = 1.0 if state == 'won' else 0.0
    elif state == 'won':
        multiplier = event.won_point_multiplier
    elif state == 'lost':
        multiplier = event.loss_point_multiplier
    else:
        multiplier = 0.0
    
    # round 3 hane: kombine oranlar 9.072 gibi 3 hane olabiliyor, 2'ye yuvarlayınca 9.07→9070 (9072 olmalı)
    truncated_odds = round(coupon.odds, 3)
    
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
    
    # round: floor ile 1694.999... → 1694.99 oluyordu (750×2.26=1695 olmalı)
    final_points = round(base_points * multiplier, 2)
    
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

async def process_coupons(
    target_event_id: Optional[int] = None,
    job_id: Optional[int] = None,
    scan_hours: int = 24,
    start_date_override: Optional[str] = None,
    end_date_override: Optional[str] = None,
):
    """
    Kuponları işleyen ana fonksiyon.
    scan_hours: Geriye dönük kaç saatlik periyodu tarayacağını belirler (varsayılan: 24).
    start_date_override, end_date_override: Belirli tarih aralığı (YYYY-MM-DDTHH:MM:SS veya DD-MM-YY HH:MM).
    Override verildiğinde MaxRows=500 ve sayfa gecikmesi kullanılır.
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

        # Stale job sonrası cooldown: Rate limit nedeniyle takılan job iptal edildiyse,
        # hemen yeni job başlatma - API'nin toparlanması için 5 dk bekle
        global _stale_cooldown_until
        if job_id is None and _stale_cooldown_until and datetime.utcnow() < _stale_cooldown_until:
            wait_sec = (_stale_cooldown_until - datetime.utcnow()).total_seconds()
            logger.warning(f"⏳ Stale job sonrası cooldown ({wait_sec:.0f}s kaldı). Bu run atlanıyor.")
            return

        # Eşzamanlılık kilidi: Başka bir worker çalışıyor mu kontrol et
        STALE_JOB_HOURS = 1.5  # 1.5 saatten uzun running/pending = takılı (rate limit/crash)
        running_query = db.query(WorkerLog).filter(WorkerLog.status.in_(["running", "pending"]))
        if job_id:
            running_query = running_query.filter(WorkerLog.id != job_id)

        running_job = running_query.first()
        if running_job:
            job_age = (datetime.utcnow() - (running_job.created_at or datetime.utcnow())).total_seconds() / 3600
            if job_age >= STALE_JOB_HOURS:
                logger.warning(f"⚠️ Job {running_job.id} {job_age:.1f} saattir takılı. failed olarak işaretleniyor.")
                running_job.status = "failed"
                running_job.completed_at = datetime.utcnow()
                running_job.error_message = (running_job.error_message or "") + f" [Stale: {job_age:.1f}h]"
                db.commit()
                # Rate limit toparlanması için 5 dk cooldown - yeni job hemen başlamasın
                _stale_cooldown_until = datetime.utcnow() + timedelta(minutes=5)
                logger.warning(f"⏳ 5 dakika cooldown başlatıldı. Sonraki cron'da tekrar denenecek.")
            else:
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

        # GetBetReport: Tek istekle tüm kuponları çek (history yerine)
        client_id_to_participant = {p.client_id: p for p in participants}
        enrolled_client_ids = {p.client_id for p in participants}
        tr_offset = timedelta(hours=3)
        now_utc = datetime.utcnow()
        now_tr = now_utc + tr_offset
        scan_limit_ago_tr = now_tr - timedelta(hours=scan_hours)
        scan_limit_ago_utc = scan_limit_ago_tr - tr_offset
        event_starts_utc = [e.start_date - tr_offset for e in active_events]
        earliest_event_utc = min(event_starts_utc) if event_starts_utc else now_utc
        scan_start_utc = max(earliest_event_utc - timedelta(hours=1), scan_limit_ago_utc)
        bc_offset = timedelta(hours=3)  # Betconstruct Local = Turkey UTC+3
        if start_date_override and end_date_override:
            start_str = start_date_override
            end_str = end_date_override
        else:
            start_str = (scan_start_utc + bc_offset).strftime("%Y-%m-%dT%H:%M:%SZ")
            end_str = (now_utc + bc_offset + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")

        if job_id:
            update_job_status("running", total=len(participants))
        cancel_event = asyncio.Event()
        set_active_cancel_event(cancel_event)
        poller_task = None
        if job_id:
            poller_task = asyncio.create_task(_cancellation_poller(job_id, cancel_event))

        # event_lost_coupons istatistikleri için her zaman Won+Lost çek (loss_point_multiplier=0 olsa bile)
        state_filter = None  # Won+Lost
        import time
        t_start = time.perf_counter()
        # Tarih override veya scan_hours>24: MaxRows=500 + 4sn sayfa arası
        use_pagination = (start_date_override and end_date_override) or scan_hours > 24
        max_rows = 500 if use_pagination else 0
        page_delay = 4.0 if use_pagination else 0
        logger.info(f"[Worker] GetBetReport başlatılıyor | Tarih: {start_str} - {end_str} | State: {'Won+Lost' if state_filter is None else 'Won only'} | Katılımcı: {len(participants)} | Pagination: {max_rows or 'off'}")
        bet_report_data = await fetch_bet_report(start_str, end_str, include_selections=True, state_filter=state_filter, max_rows=max_rows, page_delay_seconds=page_delay)
        t_api = time.perf_counter() - t_start
        bets = bet_report_data.get("Bets", []) or []
        enrolled_count = len(enrolled_client_ids)
        single_count = sum(1 for b in bets if b.get("Type") == 1 or (str(b.get("TypeName", "")).lower() == "single"))
        multi_count = sum(1 for b in bets if b.get("Type") in (2, 3) or (str(b.get("TypeName", "")).lower() in ("multiple", "combo", "accumulator", "kombine", "parlay")))
        other_count = len(bets) - single_count - multi_count
        won_api = sum(1 for b in bets if b.get("State") == 4 or "won" in str(b.get("StateName", "")).lower())
        lost_api = sum(1 for b in bets if b.get("State") == 3 or "lost" in str(b.get("StateName", "")).lower())
        logger.info(f"[Worker] GetBetReport tamamlandı | API: {len(bets)} kupon ({t_api:.1f}s) | Won: {won_api} Lost: {lost_api} | Single: {single_count} | Multi: {multi_count} | Diğer: {other_count}")

        total_saved = 0
        lost_inserted = 0  # event_lost_coupons'a eklenen
        eligible_bets = []
        matched_count = 0
        for bet_history in bets:
            try:
                if cancel_event.is_set():
                    logger.info(f"   [WORKER] Job {job_id} cancelled.")
                    return
                client_id = bet_history.get("ClientId")
                if client_id is None or client_id not in enrolled_client_ids:
                    continue
                matched_count += 1
                user = client_id_to_participant.get(client_id)
                if not user:
                    continue
                user_enrollments = user_enrollment_map.get(user.id, {})
                user_target_events = [event_info_map[eid]["object"] for eid in user_enrollments if eid in event_info_map]
                if not user_target_events:
                    continue

                bet_id = str(bet_history.get("BetId") or bet_history.get("Id"))
                if not bet_id:
                    continue

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
                raw_calc = bet_history.get("CalcDateLocal") or bet_history.get("CalcDate")
                if mapped_state not in ["won", "lost"]:
                    continue
                is_bonus_money = bet_history.get("IsBonusMoney", False)
                wagering_bonus_id = bet_history.get("WageringBonusId")
                bonus_amount = float(bet_history.get("BonusAmount", 0) or 0)
                free_bet_amount = float(bet_history.get("FreeBetAmount", 0) or 0)
                if is_bonus_money or wagering_bonus_id is not None or bonus_amount > 0 or free_bet_amount > 0:
                    continue
                type_val = bet_history.get("Type", 1)
                type_name = str(bet_history.get("TypeName", "")).lower()
                # 1=Single, 2=Multiple, 3=Accumulator/Kombine - Betconstruct farklı değerler kullanabilir
                allowed_int_types = [1, 2, 3]
                allowed_str_types = ["single", "multiple", "combo", "accumulator", "kombine", "parlay"]
                if isinstance(type_val, int) and type_val not in allowed_int_types:
                    continue
                if isinstance(type_val, str):
                    if type_val.lower() not in allowed_str_types and type_val not in ["1", "2", "3"]:
                        continue
                if type_name and type_name not in allowed_str_types:
                    continue
                amount = float(bet_history.get("Amount", 0.0) or 0.0)
                try:
                    sel_count = int(bet_history.get("SelectionCount") or type_val or 1)
                except (ValueError, TypeError):
                    sel_count = 1
                eligible_for_events = []
                raw_calc = bet_history.get("CalcDateLocal") or bet_history.get("CalcDate")
                raw_created = bet_history.get("CreatedAt") or bet_history.get("Created")
                calc_local_to_utc_offset = timedelta(hours=-3)
                bet_calc_dt_utc = None
                bet_created_dt_utc = None
                if raw_calc:
                    try:
                        clean_calc = str(raw_calc).split('.')[0].replace("Z", "").split("+")[0]
                        bet_calc_dt_parsed = datetime.strptime(clean_calc, "%Y-%m-%dT%H:%M:%S") if "T" in clean_calc else datetime.strptime(clean_calc, "%Y-%m-%d %H:%M:%S")
                        bet_calc_dt_utc = bet_calc_dt_parsed + calc_local_to_utc_offset
                    except Exception as e:
                        logger.warning(f"Bet {bet_id}: CalcDateLocal parse failed: {raw_calc}, error: {e}")
                if raw_created:
                    try:
                        clean_created = str(raw_created).split('.')[0].replace("Z", "").split("+")[0]
                        bet_created_parsed = datetime.strptime(clean_created, "%Y-%m-%dT%H:%M:%S") if "T" in clean_created else datetime.strptime(clean_created, "%Y-%m-%d %H:%M:%S")
                        bet_created_dt_utc = bet_created_parsed + calc_local_to_utc_offset
                    except Exception:
                        pass
                if bet_created_dt_utc is None:
                    bet_created_dt_utc = bet_calc_dt_utc
                if bet_calc_dt_utc is None:
                    continue
                # Katılım kontrolü: Created (oynanma) kullan.
                bet_time_for_join = bet_created_dt_utc or bet_calc_dt_utc
                for target_event in user_target_events:
                    joined_at = user_enrollments.get(target_event.id)
                    event_start_utc = target_event.start_date - tr_offset
                    event_end_utc = target_event.end_date - tr_offset
                    joined_at_utc = joined_at if joined_at else event_start_utc
                    p_start_utc = max(event_start_utc, joined_at_utc)
                    if bet_time_for_join < p_start_utc:
                        continue
                    if bet_calc_dt_utc > event_end_utc:
                        continue
                    rules = target_event.rules or {}
                    min_stake = rules.get("min_stake", 0)
                    if amount < min_stake:
                        continue
                    min_sel = rules.get("min_combination") or rules.get("min_selection_count") or 1
                    if sel_count < int(min_sel):
                        continue
                    eligible_for_events.append(target_event)
                if not eligible_for_events:
                    continue
                # Lost: event_lost_coupons istatistikleri için her zaman eligible_bets'e ekle (loss_point_multiplier=0 olsa bile)
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
                eligible_bets.append((bet_history, bet_id, mapped_state, amount, sel_count, eligible_for_events, bet_created_dt_utc, bet_calc_dt_utc, user))

            except Exception as bet_err:
                logger.warning(f"[Worker] Bet işleme hatası bet_id={bet_history.get('BetId') or bet_history.get('Id')}: {bet_err}")

        eligible_multi = sum(1 for t in eligible_bets if t[4] > 1) if eligible_bets else 0  # t[4] = sel_count
        eligible_lost = sum(1 for t in eligible_bets if t[2] == "lost")  # t[2] = mapped_state
        logger.info(f"[Worker] Filtre sonucu | Katılımcı eşleşen: {matched_count} | Uygun: {len(eligible_bets)} (multi: {eligible_multi}, lost: {eligible_lost})")

        # Phase 2: Selections - GetBetReport zaten dahil etti; eksik olanlar için DB/fetch
        import collections
        bet_ids_needing_fetch = []
        selections_cache = {}
        all_eligible_bids = [t[1] for t in eligible_bets]
        excluded_bids_map = collections.defaultdict(set)
        if all_eligible_bids:
            for row in db.query(ExcludedBetCache.bet_id, ExcludedBetCache.event_id).filter(
                ExcludedBetCache.bet_id.in_(all_eligible_bids)
            ).all():
                excluded_bids_map[row.bet_id].add(row.event_id)

        for tup in eligible_bets:
            bet_hist, bid, mapped_state, amount, sel_count, eligible_for_events, bet_created_dt, bet_calc_dt, usr = tup
            required_event_ids = set(ev.id for ev in eligible_for_events)
            already_excluded_for = excluded_bids_map.get(bid, set())
            if required_event_ids and required_event_ids.issubset(already_excluded_for):
                continue
            if bet_hist.get("Selections") or bet_hist.get("BetSelections"):
                selections_cache[bid] = {"Selections": bet_hist.get("Selections") or bet_hist.get("BetSelections")}
            else:
                existing = db.query(Coupon).filter(Coupon.bet_id == bid).first()
                if existing and existing.bet_data and existing.bet_data.get("Selections"):
                    selections_cache[bid] = {"Selections": existing.bet_data["Selections"]}
                else:
                    bet_ids_needing_fetch.append(bid)

        if bet_ids_needing_fetch:
            logger.info(f"[Worker] {len(bet_ids_needing_fetch)} kupon için selection fetch (GetBetReport'ta eksikti)")
            await _interruptible_sleep(1.0)
            async with httpx.AsyncClient(timeout=30) as http_client:
                fetched = await fetch_bet_selections_batch(bet_ids_needing_fetch, http_client)
                selections_cache.update(fetched)

        # Phase 3: Process each bet with cached selections
        for tup in eligible_bets:
            bet_history, bet_id, mapped_state, amount, sel_count, eligible_for_events, bet_created_dt_utc, bet_calc_dt_utc = tup[:8]
            user = tup[8]
            selections_for_bet = []
            if bet_history.get("Selections"):
                selections_for_bet = bet_history["Selections"]
            elif bet_id in selections_cache:
                sel_data = selections_cache.get(bet_id, {})
                selections_for_bet = sel_data.get("Selections", [])
                bet_history["Selections"] = selections_for_bet
            final_events = []
            skipped_events_due_to_missing_data = set()
            for event in eligible_for_events:
                rules = event.rules or {}
                allowed_leagues = list(rules.get("allowed_league_ids") or []) + list(rules.get("yan_bahis_ids") or [])
                min_odd = float(rules.get("min_odd", 0) or 0)
                all_valid = True
                is_missing_selections = False
                if min_odd > 0:
                    if not selections_for_bet:
                        all_valid = False
                        is_missing_selections = True
                    else:
                        for sel in selections_for_bet:
                            sel_price = float(sel.get("Price", 0) or sel.get("Odds", 0) or sel.get("Coefficient", 0) or 0)
                            if sel_price < min_odd:
                                all_valid = False
                                break
                if allowed_leagues and all_valid:
                    if not selections_for_bet:
                        if mapped_state == "lost" and float(getattr(event, 'loss_point_multiplier', 0)) == 0:
                            all_valid = True
                        else:
                            all_valid = False
                            is_missing_selections = True
                    else:
                        all_valid = all(str(s.get("CompetitionId")) in [str(lid) for lid in allowed_leagues] for s in selections_for_bet)
                if all_valid:
                    final_events.append(event)
                elif is_missing_selections:
                    skipped_events_due_to_missing_data.add(event.id)
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
            excluded_events = [ev for ev in eligible_for_events if ev not in final_events and ev.id not in skipped_events_due_to_missing_data]
            for ex_ev in excluded_events:
                try:
                    exists = db.query(ExcludedBetCache).filter(
                        ExcludedBetCache.bet_id == bet_id,
                        ExcludedBetCache.event_id == ex_ev.id
                    ).first()
                    if not exists:
                        db.add(ExcludedBetCache(bet_id=bet_id, client_id=user.client_id, event_id=ex_ev.id))
                except Exception as cache_err:
                    logger.warning(f"Bet {bet_id} (Event {ex_ev.id}) cache save failed: {cache_err}")
                    db.rollback()
            try:
                if excluded_events:
                    db.commit()
            except Exception as e:
                logger.warning(f"Bet {bet_id} excluded events commit failed: {e}")
                db.rollback()
            if not final_events:
                continue
            try:
                existing_coupon = db.query(Coupon).filter(Coupon.bet_id == bet_id).first()
                price = float(bet_history.get("Price", 1.0) or 1.0)
                winning_amount = float(bet_history.get("WinAmount") or bet_history.get("WinningAmount") or bet_history.get("Payout") or 0.0)
                if not existing_coupon:
                    new_coupon = Coupon(
                        client_id=user.client_id, bet_id=bet_id, event_id=final_events[0].id,
                        stake=amount, odds=price, combination_count=sel_count, state=mapped_state,
                        is_live=bool(bet_history.get("IsLive", False)), bet_data=bet_history,
                        created_at=bet_calc_dt_utc, winning=winning_amount, is_processed=True, processed_at=datetime.utcnow()
                    )
                    db.add(new_coupon)
                    db.flush()
                    existing_coupon = new_coupon
                    total_saved += 1
                else:
                    if existing_coupon.state != mapped_state or existing_coupon.winning != winning_amount:
                        existing_coupon.state = mapped_state
                        existing_coupon.winning = winning_amount
                        existing_coupon.processed_at = datetime.utcnow()
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
                    if mapped_state == "lost":
                        try:
                            exists = db.query(EventLostCoupon).filter(
                                EventLostCoupon.event_id == event.id,
                                EventLostCoupon.coupon_id == existing_coupon.id
                            ).first()
                            if not exists:
                                db.add(EventLostCoupon(
                                    event_id=event.id, coupon_id=existing_coupon.id,
                                    client_id=user.client_id, stake=existing_coupon.stake
                                ))
                                lost_inserted += 1
                        except Exception as elc_err:
                            logger.warning(f"EventLostCoupon insert failed for bet {bet_id}: {elc_err}")
            except Exception as bet_err:
                logger.error(f"Bet {bet_id} save failed: {bet_err}")
                db.rollback()
                continue

        t_total = time.perf_counter() - t_start
        logger.info(f"[Worker] Tamamlandı | Tarandı: {len(bets)} | Uygun: {len(eligible_bets)} | Yeni: {total_saved} | event_lost_coupons: {lost_inserted} işlendi | Toplam süre: {t_total:.1f}s (API: {t_api:.1f}s)")

        # Update Participant Totals (tüm katılımcılar için)
        for user in participants:
            user_enrollments = user_enrollment_map.get(user.id, {})
            user_target_events = [event_info_map[eid]["object"] for eid in user_enrollments if eid in event_info_map]
            for event in user_target_events:
                total_points = db.query(func.sum(CouponEventResult.points_earned)).filter(
                    CouponEventResult.event_id == event.id,
                    CouponEventResult.coupon_id.in_(db.query(Coupon.id).filter(Coupon.client_id == user.client_id)),
                    CouponEventResult.is_eligible == True
                ).scalar() or 0.0
                enrollment = db.query(EventParticipant).filter(EventParticipant.event_id == event.id, EventParticipant.participant_id == user.id).first()
                if enrollment:
                    enrollment.total_points = total_points

        db.commit()
        if job_id:
            update_job_status("completed", processed=len(bets), saved=total_saved)
    except WorkerCancelledException as wc:
        logger.info(f"   [WORKER] Interrupted by cancellation: {wc}")
        db.rollback()
        if job_id:
            update_job_status("cancelled")
    except Exception as e:
        import traceback
        logger.error(f"[Worker] Hata: {e}")
        logger.error(traceback.format_exc())
        if job_id:
            update_job_status("failed", error=str(e))
        err_str = str(e).lower()
        if "rate" in err_str or "request lim" in err_str or "429" in err_str:
            _stale_cooldown_until = datetime.utcnow() + timedelta(minutes=5)
            logger.warning(f"⏳ Rate limit hatası tespit edildi. 5 dk cooldown başlatıldı.")
    finally:
        db.close()
        # Poller task'i temizle
        if 'poller_task' in locals() and poller_task:
            poller_task.cancel()
