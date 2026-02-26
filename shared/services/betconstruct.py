import asyncio
import httpx
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from shared.settings import settings

logger = logging.getLogger(__name__)

# Rate limit durumunu global olarak takip et
_rate_limit_until = None  # Rate limit bitene kadar bekle


def _is_rate_limited_response(response: httpx.Response) -> bool:
    """BetConstruct rate limit kontrolü (403 + 'request limit' mesajı)."""
    if response.status_code == 403:
        try:
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
            await asyncio.sleep(wait_seconds)


async def _set_rate_limit_cooldown(seconds: int = 120):
    """Rate limit cooldown ayarla (varsayılan 2 dakika — API'nin söylediği süre)."""
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


async def fetch_bet_history(client_id: int, start_date: str, end_date: str, max_retries: int = 2) -> Dict[str, Any]:
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
    max_rows = 50
    safety_limit = 2000

    for attempt in range(max_retries + 1):
        try:
            # Rate limit varsa bekle
            await _wait_if_rate_limited()

            async with httpx.AsyncClient(timeout=30) as client:
                while skip_rows < safety_limit:
                    body = {
                        "BetId": None,
                        "CalcEndDateLocal": None,
                        "CalcStartDateLocal": None,
                        "ClientId": client_id,
                        "CurrencyId": "TRY",
                        "EndDateLocal": end_str,
                        "IsBonusBet": None,
                        "IsLive": None,
                        "MaxRows": max_rows,
                        "SkeepRows": skip_rows,
                        "StartDateLocal": start_str,
                        "State": None,
                        "ToCurrencyId": "TRY"
                    }

                    r = await client.post(settings.BAPI_BET_HISTORY_URL, headers=get_headers(), json=body)
                    
                    # Rate limit kontrolü
                    if _is_rate_limited_response(r):
                        await _set_rate_limit_cooldown(120)
                        if attempt < max_retries:
                            logger.warning(f"Bet history rate limited for {client_id}, retry {attempt + 1}/{max_retries}")
                            await _wait_if_rate_limited()
                            break  # Inner while'dan çık, retry döngüsüne dön
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
                    elif "Data" in data and isinstance(data["Data"], list):
                        bets_batch = data["Data"]
                    
                    if not bets_batch:
                        break
                        
                    all_bets.extend(bets_batch)
                    skip_rows += max_rows
                    
                    if len(bets_batch) < max_rows:
                        break
                else:
                    # while normal bitti (safety_limit), dış retry'dan da çık
                    break
                
                # Rate limit yüzünden break olduysa retry
                if skip_rows < safety_limit or all_bets:
                    if attempt < max_retries and not all_bets and skip_rows == 0:
                        continue  # Retry
                    break  # Başarılı veya kısmi veri var
                        
            return {"Bets": all_bets}
            
        except Exception as e:
            if "request lim" in str(e).lower() and attempt < max_retries:
                await _set_rate_limit_cooldown(120)
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
            await _set_rate_limit_cooldown(120)
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
        if _is_rate_limited_response(e.response):
            raise  # Üst katmanda retry
        logger.error(f"Error fetching bet selections for {bet_id}: {e}")
        return {}
    except Exception as e:
        logger.error(f"Error fetching bet selections for {bet_id}: {e}")
        return {}


async def fetch_bet_selections_batch(
    bet_ids: list, 
    http_client: httpx.AsyncClient = None,
    max_concurrent: int = 5,
    max_retries: int = 3,
    cooldown_base: int = 120
) -> Dict[str, Dict]:
    """
    Birden fazla bet_id için paralel selection detayı çeker.
    Max 5 eşzamanlı istek, rate limit'te 2dk cooldown + retry.
    
    Returns: {bet_id: {Selections: [...]}, ...}
    """
    if not bet_ids:
        return {}
    
    results = {}
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def fetch_one(bid: str, retry_count: int = 0):
        async with semaphore:
            # Rate limit varsa bekle
            await _wait_if_rate_limited()
            
            try:
                data = await fetch_bet_selections(bid, http_client)
                results[bid] = data
            except httpx.HTTPStatusError as e:
                if retry_count < max_retries:
                    logger.warning(f"Rate limited on {bid}! Cooldown {cooldown_base}s (retry {retry_count + 1}/{max_retries})")
                    await _wait_if_rate_limited()
                    await fetch_one(bid, retry_count + 1)
                else:
                    logger.error(f"Failed to fetch selections for {bid} after {retry_count} retries")
                    results[bid] = {}
            except Exception as e:
                logger.error(f"Error batch fetching {bid}: {e}")
                results[bid] = {}
    
    # Tüm istekleri paralel başlat
    tasks = [fetch_one(bid) for bid in bet_ids]
    await asyncio.gather(*tasks)
    
    logger.info(f"Batch fetch complete: {len(results)}/{len(bet_ids)} selections retrieved")
    return results


def get_date_range():
    """Worker için varsayılan tarih aralığını döner (Son 7 gün)."""
    end = datetime.utcnow()
    start = end - timedelta(days=7)
    return start.strftime("%Y-%m-%dT%H:%M:%SZ"), end.strftime("%Y-%m-%dT%H:%M:%SZ")
