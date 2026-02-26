import asyncio
import httpx
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from shared.settings import settings

logger = logging.getLogger(__name__)

def get_headers():
    """Betconstruct API header'larını hazırlar."""
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
    }
    if settings.BAPI_TOKEN:
        headers["Authentication"] = settings.BAPI_TOKEN
    return headers

async def fetch_bet_history(client_id: int, start_date: str, end_date: str) -> Dict[str, Any]:
    """Betconstruct'tan bahis geçmişini çeker.
    Sayfalama (Pagination) kullanarak tüm kuponları eksiksiz alır."""
    # Format: dd-MM-yy - HH:mm:ss
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
    safety_limit = 2000 # Beklenmedik sonsuz döngüleri önlemek için (Kullanıcı başına 2000 kupon fazla fazla yeter)

    try:
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
                r.raise_for_status()
                data = r.json()
                
                bets_batch = []
                # Structure parsing
                if "Data" in data and isinstance(data["Data"], dict):
                    inner_data = data["Data"]
                    if "BetData" in inner_data and isinstance(inner_data["BetData"], dict):
                        bets_batch = inner_data["BetData"].get("Objects", [])
                elif "BetData" in data and isinstance(data["BetData"], dict):
                    bets_batch = data["BetData"].get("Objects", [])
                elif "Data" in data and isinstance(data["Data"], list):
                    bets_batch = data["Data"]
                
                if not bets_batch:
                    # Yeni sayfa boş geldi, demek ki tüm kuponlar çekildi
                    break
                    
                all_bets.extend(bets_batch)
                skip_rows += max_rows
                
                # Eğer tam 50 gelmediyse, son sayfadayız demektir
                if len(bets_batch) < max_rows:
                    break
                    
        return {"Bets": all_bets}
        
    except Exception as e:
        logger.error(f"Error fetching bet history for {client_id}: {e}")
        return {"Bets": all_bets} # Hata olsa bile o ana kadar çektiklerini döndür

async def fetch_bet_selections(bet_id: str, http_client: httpx.AsyncClient = None) -> Dict[str, Any]:
    """Betconstruct'tan bahis seçim detaylarını çeker."""
    body = {
        "BetId": bet_id
    }
    
    try:
        if http_client:
            r = await http_client.post(settings.BAPI_BET_SELECTIONS_URL, headers=get_headers(), json=body)
        else:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(settings.BAPI_BET_SELECTIONS_URL, headers=get_headers(), json=body)
        
        r.raise_for_status()
        data = r.json()
        
        # API returns a List directly in some cases
        if isinstance(data, list):
            return { "Selections": data }
        
        # API returns { "Data": [...] }
        if "Data" in data:
             return { "Selections": data["Data"] }
             
        return data
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            raise  # Rate limit — üst katmanda handle edilecek
        logger.error(f"Error fetching bet selections for {bet_id}: {e}")
        return {}
    except Exception as e:
        logger.error(f"Error fetching bet selections for {bet_id}: {e}")
        return {}


async def fetch_bet_selections_batch(
    bet_ids: list, 
    http_client: httpx.AsyncClient = None,
    max_concurrent: int = 10,
    max_retries: int = 3,
    cooldown_base: int = 15
) -> Dict[str, Dict]:
    """
    Birden fazla bet_id için paralel selection detayı çeker.
    Max 10 eşzamanlı istek, rate limit'te cooldown + retry.
    
    Returns: {bet_id: {Selections: [...]}, ...}
    """
    if not bet_ids:
        return {}
    
    results = {}
    semaphore = asyncio.Semaphore(max_concurrent)
    rate_limited = asyncio.Event()  # Rate limit flag
    
    async def fetch_one(bid: str, retry_count: int = 0):
        async with semaphore:
            # Rate limit aktifse bekle
            if rate_limited.is_set():
                await asyncio.sleep(0.5)
                if rate_limited.is_set():
                    return  # Hala rate limited, atla
            
            try:
                data = await fetch_bet_selections(bid, http_client)
                results[bid] = data
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and retry_count < max_retries:
                    cooldown = cooldown_base * (retry_count + 1)
                    logger.warning(f"Rate limited! Cooldown {cooldown}s (retry {retry_count + 1}/{max_retries})")
                    rate_limited.set()
                    await asyncio.sleep(cooldown)
                    rate_limited.clear()
                    # Retry this one
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
