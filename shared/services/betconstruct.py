import asyncio
import httpx
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from shared.settings import settings

logger = logging.getLogger(__name__)

# Rate limit durumunu global olarak takip et
_rate_limit_until = None  # Rate limit bitene kadar bekle
_active_cancel_event: Optional[asyncio.Event] = None


class WorkerCancelledException(Exception):
    """Exception raised when the worker is manually cancelled by the user."""
    pass


def set_active_cancel_event(event: asyncio.Event):
    """Sets the global cancel event to allow interruptible sleeps."""
    global _active_cancel_event
    _active_cancel_event = event


async def _check_cancellation():
    """Checks if the worker was cancelled and raises an exception if so."""
    if _active_cancel_event and _active_cancel_event.is_set():
        raise WorkerCancelledException("Worker manually cancelled.")


async def _interruptible_sleep(duration: float):
    """Sleeps for duration seconds, but wakes up every 0.5s to check for cancellation."""
    slept = 0.0
    while slept < duration:
        await _check_cancellation()
        sleep_chunk = min(0.5, duration - slept)
        await asyncio.sleep(sleep_chunk)
        slept += sleep_chunk
    await _check_cancellation()


def _is_rate_limited_response(response: httpx.Response) -> bool:
    """BetConstruct rate limit kontrolü (403 + 'request limit' mesajı)."""
    if response.status_code == 403:
        try:
            if "request lim" in str(response.reason_phrase).lower():
                return True
            text = response.text or ""
            if "request lim" in text.lower():
                return True
        except:
            pass
    if response.status_code == 429:
        return True
    return False


async def _wait_if_rate_limited():
    """Global rate limit varsa bekle."""
    global _rate_limit_until
    if _rate_limit_until and datetime.utcnow() < _rate_limit_until:
        wait_seconds = (_rate_limit_until - datetime.utcnow()).total_seconds()
        if wait_seconds > 0:
            logger.warning(f"⏳ Rate limit aktif, {wait_seconds:.0f}s bekleniyor...")
            await _interruptible_sleep(wait_seconds)


async def _set_rate_limit_cooldown(seconds: int = 240):
    """Rate limit cooldown ayarla (4 dk - API mesajı 2dk diyor ama gerçekte ~4dk sürüyor)."""
    global _rate_limit_until
    _rate_limit_until = datetime.utcnow() + timedelta(seconds=seconds)
    logger.warning(f"🚫 Rate limited! {seconds}s cooldown başlatıldı.")


def get_headers():
    """Betconstruct API header'larını hazırlar."""
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
    }
    if settings.BAPI_TOKEN:
        headers["Authentication"] = settings.BAPI_TOKEN
    return headers


def get_report_headers():
    """GetBetReport için gerekli header'lar (Origin/Referer)."""
    return {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://backoffice.betconstruct.com",
        "Referer": "https://backoffice.betconstruct.com/",
        "X-Requested-With": "XMLHttpRequest",
    } | ({"Authentication": settings.BAPI_TOKEN} if settings.BAPI_TOKEN else {})


def get_stats_headers():
    """İstatistik işlemleri için özel Betconstruct API header'larını hazırlar."""
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
    }
    token = settings.STATS_BAPI_TOKEN or settings.BAPI_TOKEN
    if token:
        headers["Authentication"] = token
    return headers


def get_stats_report_headers():
    """İstatistik GetBetReport için gerekli header'lar (Origin/Referer)."""
    token = settings.STATS_BAPI_TOKEN or settings.BAPI_TOKEN
    return {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://backoffice.betconstruct.com",
        "Referer": "https://backoffice.betconstruct.com/",
        "X-Requested-With": "XMLHttpRequest",
    } | ({"Authentication": token} if token else {})


async def fetch_bet_history(client_id: int, start_date: str, end_date: str, max_retries: int = 4) -> Dict[str, Any]:
    """Betconstruct'tan bahis geçmişini çeker (GetBetHistory). Kullanılmıyor - GetBetReport kullanılıyor."""
    try:
        if "T" in start_date:
            s_dt = datetime.strptime(start_date, "%Y-%m-%dT%H:%M:%SZ")
            e_dt = datetime.strptime(end_date, "%Y-%m-%dT%H:%M:%SZ")
        else:
             s_dt = datetime.strptime(start_date, "%Y-%m-%d")
             e_dt = datetime.strptime(end_date, "%Y-%m-%d")

        start_str = s_dt.strftime("%Y-%m-%dT%H:%M:%S")
        end_str = e_dt.strftime("%Y-%m-%dT%H:%M:%S")
    except ValueError:
        start_str = start_date
        end_str = end_date

    all_bets = []
    skip_rows = 0
    max_rows = 250
    safety_limit = 2000

    for attempt in range(max_retries + 1):
        try:
            await _wait_if_rate_limited()
            rate_limit_hit = False
            async with httpx.AsyncClient(timeout=30) as client:
                while skip_rows < safety_limit:
                    body = {
                        "BetId": None,
                        "CalcEndDateLocal": end_str,
                        "CalcStartDateLocal": start_str,
                        "ClientId": client_id,
                        "CurrencyId": "TRY",
                        "EndDateLocal": None,
                        "IsBonusBet": None,
                        "IsLive": None,
                        "MaxRows": max_rows,
                        "SkeepRows": skip_rows,
                        "StartDateLocal": None,
                        "State": None,
                        "ToCurrencyId": "TRY"
                    }

                    r = await client.post(settings.BAPI_BET_HISTORY_URL, headers=get_stats_headers(), json=body)
                    
                    if _is_rate_limited_response(r):
                        await _set_rate_limit_cooldown()
                        if attempt < max_retries:
                            logger.warning(f"Bet history rate limited for {client_id}, retry {attempt + 1}/{max_retries}")
                            rate_limit_hit = True
                            break
                        else:
                            logger.error(f"Bet history rate limited for {client_id}, max retries reached")
                            return {"Bets": all_bets}
                    
                    r.raise_for_status()
                    data = r.json()
                    
                    bets_batch = []
                    if "Data" in data and isinstance(data["Data"], dict):
                        inner_data = data["Data"]
                        if "BetData" in inner_data and isinstance(inner_data["BetData"], dict):
                            bets_batch = inner_data["BetData"].get("Objects", [])
                    elif "BetData" in data and isinstance(data["BetData"], dict):
                        bets_batch = data["BetData"].get("Objects", [])
                    
                    if not bets_batch:
                        break
                        
                    all_bets.extend(bets_batch)
                    skip_rows += max_rows
                    
                    if len(bets_batch) < max_rows:
                        break
                        
                    await _interruptible_sleep(0.5)
                
                if rate_limit_hit:
                    await _wait_if_rate_limited()
                    continue
                break
                        
            return {"Bets": all_bets}
            
        except Exception as e:
            if "request lim" in str(e).lower() and attempt < max_retries:
                await _set_rate_limit_cooldown()
                await _wait_if_rate_limited()
                continue
            logger.error(f"Error fetching bet history for {client_id}: {e}")
            return {"Bets": all_bets}
    
    return {"Bets": all_bets}


async def fetch_bet_report(
    start_date: str,
    end_date: str,
    bet_id: Optional[str] = None,
    include_selections: bool = True,
    state_filter: Optional[int] = None,
    max_retries: int = 4,
    max_rows: int = 0,
    page_delay_seconds: float = 0,
) -> Dict[str, Any]:
    """
    GetBetReport API - Kuponları çeker (tüm kullanıcılar).
    max_rows=0: Tek istek, tüm kayıtlar (504 riski büyük aralıklarda).
    max_rows=500: Sayfalama ile çek, sayfalar arası page_delay_seconds bekler (manuel worker için).
    State=4 sadece Won, State=3 sadece Lost.
    """
    try:
        # Girdi: 2026-03-08T21:00:00Z veya 2026-03-08 -> Çıktı: DD-MM-YY - HH:MM:SS
        def _parse(s: str) -> datetime:
            clean = str(s).replace("Z", "").split("+")[0].strip()[:19]
            if "T" in clean:
                return datetime.strptime(clean, "%Y-%m-%dT%H:%M:%S")
            return datetime.strptime(clean[:10], "%Y-%m-%d")
        s_dt = _parse(start_date)
        e_dt = _parse(end_date)
        start_str = s_dt.strftime("%d-%m-%y - %H:%M:%S")
        end_str = e_dt.strftime("%d-%m-%y - %H:%M:%S")
    except (ValueError, IndexError):
        start_str = start_date
        end_str = end_date

    body = {
        "ToCurrencyId": "TRY",
        "byPassTotals": False,
        "filterBet": {
            "AmountFrom": None,
            "AmountTo": None,
            "WinningAmountFrom": None,
            "WinningAmountTo": None,
            "BetTypes": [1, 2] if bet_id is None else [],
            "BarCode": None,
            "BetId": bet_id,
            "BetShopGroupId": None,
            "BetshopId": None,
            "BonusTypeId": "",
            "CalcEndDateLocal": end_str,
            "CalcStartDateLocal": start_str,
            "CashDeskId": None,
            "ClientBetShopGroupId": None,
            "ClientCashdeskId": "",
            "ClientExternalId": "",
            "ClientId": "",
            "ClientLogin": None,
            "ClientLoginIp": "",
            "CurrencyId": None,
            "EndDateLocal": None,
            "ExternalId": None,
            "InfoBetshopId": "",
            "InfoCashDeskId": "",
            "IsBonusBet": None,
            "IsCashDeskPaid": None,
            "IsClientWithBetShop": None,
            "IsLive": None,
            "IsOrderedDesc": True,
            "IsRecalculated": None,
            "IsSuperBet": None,
            "IsTest": False,
            "IsWithSelections": include_selections,
            "MaxRows": max_rows if max_rows > 0 else (20 if bet_id else 0),
            "MaxSelectionCount": None,
            "MinSelectionCount": None,
            "Number": None,
            "OrderedItem": 9,
            "PriceFrom": None,
            "PriceTo": None,
            "SkeepRows": 0,
            "Sources": [],
            "SportsbookProfileId": "",
            "StartDateLocal": None,
            "State": state_filter,
            "WinningAmountFrom": None,
            "WinningAmountTo": None,
        },
        "filterBetSelection": {"SportId": None, "RegionId": None, "CompetitionId": None, "MatchId": None},
        "isCalcTime": True,
        "matchFilter": {"currentSport": None, "currentRegion": None, "currentCompetition": None, "currentMatch": None},
    }

    body["filterBet"]["SkeepRows"] = 0
    all_bets = []
    states_to_fetch = [4, 3] if state_filter is None else [state_filter]
    use_pagination = max_rows > 0
    page_size = max_rows if use_pagination else 0

    for st in states_to_fetch:
        body["filterBet"]["State"] = st
        skip_rows = 0
        batch = []
        while True:
            if use_pagination:
                body["filterBet"]["SkeepRows"] = skip_rows
            for attempt in range(max_retries + 1):
                try:
                    await _wait_if_rate_limited()
                    async with httpx.AsyncClient(timeout=180) as client:
                        r = await client.post(settings.BAPI_BET_REPORT_URL, headers=get_stats_report_headers(), json=body)
                    if _is_rate_limited_response(r):
                        await _set_rate_limit_cooldown()
                        if attempt < max_retries:
                            await _wait_if_rate_limited()
                            continue
                        break
                    r.raise_for_status()
                    data = r.json()
                    if data.get("HasError"):
                        logger.error(f"GetBetReport API error (State={st}): {data.get('AlertMessage', '')}")
                        break
                    bd = data.get("Data", {}) or {}
                    if isinstance(bd, dict) and "BetData" in bd:
                        batch = bd["BetData"].get("Objects", []) or []
                        all_bets.extend(batch)
                        if use_pagination and len(batch) < page_size:
                            break
                        if use_pagination and batch:
                            skip_rows += page_size
                            if page_delay_seconds > 0:
                                await _interruptible_sleep(page_delay_seconds)
                        break
                    batch = []
                    break
                except Exception as e:
                    if attempt < max_retries:
                        logger.warning(f"GetBetReport error State={st} (retry {attempt + 1}/{max_retries}): {e}")
                        await _interruptible_sleep(2.0)
                        continue
                    logger.error(f"GetBetReport failed State={st}: {e}")
                    batch = []
                    break
            if not use_pagination or not batch or len(batch) < page_size:
                break
        if len(states_to_fetch) > 1 and all_bets:
            await _interruptible_sleep(1.0)
    for b in all_bets:
        if b.get("BetSelections") and not b.get("Selections"):
            b["Selections"] = b["BetSelections"]
    logger.info(f"GetBetReport: {len(all_bets)} kupon ({len(states_to_fetch)} state)")
    return {"Bets": all_bets}


async def fetch_bet_selections(bet_id: str, http_client: httpx.AsyncClient = None) -> Dict[str, Any]:
    """Betconstruct'tan bahis seçim detaylarını çeker."""
    body = {
        "BetId": bet_id
    }
    
    # Rate limit varsa bekle
    await _wait_if_rate_limited()
    
    try:
        if http_client:
            r = await http_client.post(settings.BAPI_BET_SELECTIONS_URL, headers=get_stats_headers(), json=body)
        else:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(settings.BAPI_BET_SELECTIONS_URL, headers=get_stats_headers(), json=body)
        
        # Rate limit kontrolü
        if _is_rate_limited_response(r):
            await _set_rate_limit_cooldown(240)
            raise httpx.HTTPStatusError(
                "Rate limited", request=r.request, response=r
            )
        
        r.raise_for_status()
        data = r.json()
        
        if isinstance(data, list):
            return { "Selections": data }
        
        if "Data" in data:
             return { "Selections": data["Data"] }
             
        return data
    except httpx.HTTPStatusError as e:
        if _is_rate_limited_response(e.response) or "request lim" in str(e).lower():
            raise  # Üst katmanda retry yapabilmesi için hatayı fırlat
        logger.error(f"Error fetching bet selections for {bet_id}: {e}")
        return {}
    except Exception as e:
        logger.error(f"Error fetching bet selections for {bet_id}: {e}")
        return {}


async def fetch_bet_selections_batch(
    bet_ids: list, 
    http_client: httpx.AsyncClient = None,
    max_retries: int = 4,
    cooldown: int = 120
) -> Dict[str, Dict]:
    """
    Bet selection detaylarını sıralı çeker.
    Her 10 istekte 10sn, arada 1sn bekleme (rate limit koruması).
    Rate limit olursa cooldown + retry.
    
    Returns: {bet_id: {Selections: [...]}, ...}
    """
    if not bet_ids:
        return {}
    
    results = {}
    
    async def fetch_one(bid: str):
        for attempt in range(max_retries + 1):
            try:
                await _wait_if_rate_limited()
                data = await fetch_bet_selections(bid, http_client)
                results[bid] = data
                return
            except httpx.HTTPStatusError as e:
                if attempt < max_retries:
                    logger.warning(f"Rate limited on {bid}, waiting {cooldown}s (retry {attempt + 1}/{max_retries})")
                    await _set_rate_limit_cooldown(cooldown)
                    await _wait_if_rate_limited()
                    continue
                else:
                    logger.error(f"Failed to fetch selections for {bid} after {max_retries} retries")
                    results[bid] = {}
            except Exception as e:
                logger.error(f"Error fetching selections for {bid}: {e}")
                results[bid] = {}
                return
    
    for i, bid in enumerate(bet_ids):
        await fetch_one(bid)
        # Chunk delay: her 10'da 10sn, arada 1sn (2dk pencerede limit ~25-30)
        if i + 1 < len(bet_ids):
            if (i + 1) % 10 == 0:
                await _interruptible_sleep(9.0)
            else:
                await _interruptible_sleep(1.0)
            
    logger.info(f"Batch fetch complete: {len(results)}/{len(bet_ids)} selections retrieved")
    return results
