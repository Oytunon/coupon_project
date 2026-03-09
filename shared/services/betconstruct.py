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


async def fetch_bet_history(client_id: int, start_date: str, end_date: str, max_retries: int = 4) -> Dict[str, Any]:
    """Betconstruct'tan bahis geçmişini çeker.
    Sayfalama (Pagination) kullanarak tüm kuponları eksiksiz alır.
    Rate limit durumunda cooldown + retry."""
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
    max_rows = 250  # OPTİMİZASYON: Tek seferde 50 yerine 250 kupon çekerek API istek sayısını %80 azaltıyoruz
    safety_limit = 2000

    for attempt in range(max_retries + 1):
        try:
            # Rate limit varsa bekle
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

                    r = await client.post(settings.BAPI_BET_HISTORY_URL, headers=get_headers(), json=body)
                    
                    # Rate limit kontrolü
                    if _is_rate_limited_response(r):
                        await _set_rate_limit_cooldown()
                        if attempt < max_retries:
                            logger.warning(f"Bet history rate limited for {client_id}, retry {attempt + 1}/{max_retries}")
                            rate_limit_hit = True
                            break  # Inner while'dan çık, retry döngüsüne dön
                        else:
                            logger.error(f"Bet history rate limited for {client_id}, max retries reached")
                            return {"Bets": all_bets}
                    
                    r.raise_for_status()
                    data = r.json()
                    
                    bets_batch = []
                    # Doğru iç içe (nested) kontrol. Çünkü API, 250 data'yı "BetData" altındaki "Objects" içine gömüyor.
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
                    
                    # Eğer aldığımız kupon 250'den azsa, daha fazla sayfa yoktur.
                    if len(bets_batch) < max_rows:
                        break
                        
                    # ÇOK ÖNEMLİ: Sayfalar arası geçerken API'yi yormamak için kısa bir mola ver!
                    await _interruptible_sleep(0.5)
                
                # Rate limit yüzünden break olduysa → retry (cooldown sonrası)
                # Boş sonuç veya normal bitti → retry YAPMA
                if rate_limit_hit:
                    await _wait_if_rate_limited()
                    continue  # Dış for döngüsünde retry
                break  # Normal sonuç, dış döngüden çık
                        
            return {"Bets": all_bets}
            
        except Exception as e:
            if "request lim" in str(e).lower() and attempt < max_retries:
                await _set_rate_limit_cooldown()
                await _wait_if_rate_limited()
                continue
            logger.error(f"Error fetching bet history for {client_id}: {e}")
            return {"Bets": all_bets}
    
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
            r = await http_client.post(settings.BAPI_BET_SELECTIONS_URL, headers=get_headers(), json=body)
        else:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(settings.BAPI_BET_SELECTIONS_URL, headers=get_headers(), json=body)
        
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
    Her 10 istekte 7.5sn, arada 0.7sn bekleme (rate limit koruması).
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
        # Chunk delay: her 10'da 7.5sn, arada 0.7sn (limit yememek için orta yol)
        if i + 1 < len(bet_ids):
            if (i + 1) % 10 == 0:
                await _interruptible_sleep(7.5)
            else:
                await _interruptible_sleep(0.7)
            
    logger.info(f"Batch fetch complete: {len(results)}/{len(bet_ids)} selections retrieved")
    return results
