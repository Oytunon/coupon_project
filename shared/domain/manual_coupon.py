"""
Manuel kupon ekleme - GetBetReport ile tek kupon çekip sisteme kaydeder.
"""
import logging
from datetime import datetime, timedelta
from typing import Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from shared.models.coupon import Coupon
from shared.models.coupon_event_result import CouponEventResult
from shared.models.event import Event
from shared.models.participant import Participant
from shared.models.enrollment import EventParticipant
from shared.domain.scoring_engine import calculate_points_for_event
from shared.domain.rules_validator import is_valid_for_event
from shared.services.betconstruct import fetch_bet_report, fetch_bet_selections

logger = logging.getLogger(__name__)

# Hata kodları
BET_NOT_FOUND = "BET_NOT_FOUND"
BET_ID_EXISTS = "BET_ID_EXISTS"
PARTICIPANT_NOT_ENROLLED = "PARTICIPANT_NOT_ENROLLED"
RULES_NOT_MET = "RULES_NOT_MET"
BET_SELECTIONS_MISSING = "BET_SELECTIONS_MISSING"
RATE_LIMITED = "RATE_LIMITED"


async def add_manual_coupon(
    db: Session,
    event_id: int,
    bet_id: str,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Bet ID ile GetBetReport'tan kupon çeker, kurallara uygunluğu kontrol eder, kaydeder.
    Returns: (success, result_dict)
    result_dict: success=True ise {coupon_id, points_earned, client_login, message}
                 success=False ise {code, detail}
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return False, {"code": "EVENT_NOT_FOUND", "detail": "Event bulunamadı."}

    bet_id_str = str(bet_id).strip()
    if not bet_id_str:
        return False, {"code": "INVALID_INPUT", "detail": "Bet ID boş olamaz."}

    # 1. Bet ID zaten var mı?
    existing = db.query(Coupon).filter(Coupon.bet_id == bet_id_str).first()
    if existing:
        return False, {"code": BET_ID_EXISTS, "detail": "Bu Bet ID zaten sistemde kayıtlı."}

    # 2. GetBetReport - son 30 gün
    try:
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(days=30)
        start_str = start_dt.strftime("%Y-%m-%d")
        end_str = end_dt.strftime("%Y-%m-%d")

        report = await fetch_bet_report(
            start_str, end_str,
            bet_id=bet_id_str,
            include_selections=True,
            max_rows=20,
        )
        bets = report.get("Bets", [])
    except Exception as e:
        err_str = str(e).lower()
        if "rate" in err_str or "limit" in err_str or "429" in err_str:
            return False, {"code": RATE_LIMITED, "detail": "BAPI rate limit. Lütfen birkaç dakika sonra tekrar deneyin."}
        logger.error(f"GetBetReport error for bet_id={bet_id_str}: {e}")
        return False, {"code": BET_NOT_FOUND, "detail": "Betconstruct API'de bu kupon bulunamadı (son 30 gün)."}

    if not bets:
        return False, {"code": BET_NOT_FOUND, "detail": "Betconstruct API'de bu kupon bulunamadı (son 30 gün)."}

    bet_history = bets[0]
    client_id = bet_history.get("ClientId")
    client_login = bet_history.get("ClientLogin", "")

    if not client_id:
        return False, {"code": BET_NOT_FOUND, "detail": "Kupon verisinde ClientId bulunamadı."}

    # 3. Participant + EventParticipant kontrolü
    participant = db.query(Participant).filter(Participant.client_id == client_id).first()
    if not participant:
        return False, {"code": PARTICIPANT_NOT_ENROLLED, "detail": "Kullanıcı bu kampanyaya kayıtlı değil."}

    enrollment = db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id,
        EventParticipant.participant_id == participant.id,
    ).first()
    if not enrollment:
        return False, {"code": PARTICIPANT_NOT_ENROLLED, "detail": "Kullanıcı bu kampanyaya kayıtlı değil."}

    # 4. Selections
    selections_for_bet = bet_history.get("Selections") or bet_history.get("BetSelections") or []
    if not selections_for_bet:
        try:
            sel_data = await fetch_bet_selections(bet_id_str)
            selections_for_bet = sel_data.get("Selections", []) or sel_data.get("Data", [])
            if isinstance(selections_for_bet, dict):
                selections_for_bet = selections_for_bet.get("Selections", []) or []
        except Exception as e:
            logger.warning(f"fetch_bet_selections failed for {bet_id_str}: {e}")

    selections_data = {"Selections": selections_for_bet}
    # rules_validator için EquivalentAmount - yoksa Amount kullan
    if not bet_history.get("EquivalentAmount") and bet_history.get("Amount"):
        bet_history = {**bet_history, "EquivalentAmount": bet_history["Amount"]}

    # 5. rules_validator - allowed_league_ids boşsa selection zorunluluğu yok
    rules = event.rules or {}
    allowed_leagues = list(rules.get("allowed_league_ids") or []) + list(rules.get("yan_bahis_ids") or [])
    min_odd = float(rules.get("min_odd", 0) or 0)

    if allowed_leagues or min_odd > 0:
        if not selections_for_bet:
            return False, {"code": BET_SELECTIONS_MISSING, "detail": "Kupon seçimleri alınamadı."}

    if not is_valid_for_event(bet_history, selections_data, event):
        stake = float(bet_history.get("Amount") or bet_history.get("EquivalentAmount") or 0)
        min_stake = rules.get("min_stake", 100)
        detail = f"Kupon kampanya kurallarına uygun değil."
        if stake < min_stake:
            detail = f"Kupon kampanya kurallarına uygun değil: Stake {stake} < {min_stake}"
        return False, {"code": RULES_NOT_MET, "detail": detail}

    # 6. Coupon + CouponEventResult oluştur (scoring_engine ile aynı mantık)
    state_id = bet_history.get("State", 0)
    mapped_state = "won" if state_id == 4 else "lost"
    amount = float(bet_history.get("Amount", 0) or 0)
    price = float(bet_history.get("Price", 1) or 1)
    winning = float(bet_history.get("WinningAmount") or bet_history.get("WinAmount") or 0)
    sel_count = int(bet_history.get("SelectionCount") or bet_history.get("Type") or 1)
    is_live = bool(bet_history.get("IsLive", False))

    raw_created = bet_history.get("Created") or bet_history.get("CalcDateLocal") or bet_history.get("CalcDate")
    created_at = datetime.utcnow()
    if raw_created:
        try:
            clean = str(raw_created).split(".")[0].replace("Z", "").split("+")[0]
            parsed = datetime.strptime(clean, "%Y-%m-%dT%H:%M:%S") if "T" in clean else datetime.strptime(clean[:19], "%Y-%m-%d %H:%M:%S")
            created_at = parsed + timedelta(hours=-3)  # TR to UTC
        except Exception:
            pass

    if selections_for_bet and not bet_history.get("Selections"):
        bet_history = {**bet_history, "Selections": selections_for_bet}

    new_coupon = Coupon(
        client_id=client_id,
        bet_id=bet_id_str,
        event_id=event_id,
        stake=amount,
        odds=price,
        combination_count=sel_count,
        state=mapped_state,
        is_live=is_live,
        bet_data=bet_history,
        created_at=created_at,
        winning=winning,
        is_processed=True,
        processed_at=datetime.utcnow(),
    )
    db.add(new_coupon)
    db.flush()

    calc_points, calc_details = calculate_points_for_event(new_coupon, event)
    cer = CouponEventResult(
        coupon_id=new_coupon.id,
        event_id=event_id,
        is_eligible=True,
        coupon_state=mapped_state,
        points_earned=calc_points,
        points_calculation=calc_details,
        evaluated_at=datetime.utcnow(),
        last_checked_at=datetime.utcnow(),
    )
    db.add(cer)

    # 7. EventParticipant total_points güncelle
    total_points = db.query(func.coalesce(func.sum(CouponEventResult.points_earned), 0.0)).filter(
        CouponEventResult.event_id == event_id,
        CouponEventResult.coupon_id.in_(db.query(Coupon.id).filter(Coupon.client_id == client_id)),
        CouponEventResult.is_eligible == True,
    ).scalar() or 0.0
    enrollment.total_points = total_points

    db.commit()
    return True, {
        "coupon_id": new_coupon.id,
        "points_earned": calc_points,
        "client_login": client_login,
        "message": f"Kupon eklendi. Kullanıcı: {client_login}",
    }
