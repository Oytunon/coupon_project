import httpx
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
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
    """Betconstruct'tan bahis geçmişini çeker."""
    # Format: dd-MM-yy - HH:mm:ss
    # Using python's strftime. BAPI expects this specific format.
    try:
        # Inputs are ISO format "YYYY-MM-DDTHH:MM:SZ", convert to datetime first
        if "T" in start_date:
            s_dt = datetime.strptime(start_date, "%Y-%m-%dT%H:%M:%SZ")
            e_dt = datetime.strptime(end_date, "%Y-%m-%dT%H:%M:%SZ")
        else:
            # Fallback if already date object/other string
             s_dt = datetime.strptime(start_date, "%Y-%m-%d")
             e_dt = datetime.strptime(end_date, "%Y-%m-%d")

        start_str = s_dt.strftime("%d-%m-%y - %H:%M:%S")
        end_str = e_dt.strftime("%d-%m-%y - %H:%M:%S")
    except ValueError:
        # Fallback to direct use if parsing fails (unlikely with current flow)
        start_str = start_date
        end_str = end_date

    body = {
        "BetId": None,
        "CalcEndDateLocal": None,
        "CalcStartDateLocal": None,
        "ClientId": client_id,
        "CurrencyId": "TRY",
        "EndDateLocal": end_str,
        "IsBonusBet": None,
        "IsLive": None,
        "MaxRows": 20,
        "SkeepRows": 0,
        "StartDateLocal": start_str,
        "State": None,
        "ToCurrencyId": "TRY"
    }
    
    # MOCK logic for development
    # MOCK logic removed during cleanup
    # if client_id == 12345:
    #     pass

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(settings.BAPI_BET_HISTORY_URL, headers=get_headers(), json=body)
            r.raise_for_status()
            data = r.json()
            return data.get("Data") or data
    except Exception as e:
        logger.error(f"Error fetching bet history for {client_id}: {e}")
        return {}

async def fetch_bet_selections(bet_id: str) -> Dict[str, Any]:
    """Betconstruct'tan bahis seçim detaylarını çeker."""
    body = {
        "BetId": bet_id
    }
    
    # MOCK logic for development
    if bet_id == "99999":
        return {"Data": {"Objects": []}}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(settings.BAPI_BET_SELECTIONS_URL, headers=get_headers(), json=body)
            r.raise_for_status()
            data = r.json()
            return data.get("Data") or data
    except Exception as e:
        logger.error(f"Error fetching bet selections for {bet_id}: {e}")
        return {}

def get_date_range():
    """Worker için varsayılan tarih aralığını döner (Son 48 saat)."""
    end = datetime.utcnow()
    start = end - timedelta(days=2)
    return start.strftime("%Y-%m-%dT%H:%M:%SZ"), end.strftime("%Y-%m-%dT%H:%M:%SZ")
