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

        start_str = s_dt.strftime("%Y-%m-%dT%H:%M:%S")
        end_str = e_dt.strftime("%Y-%m-%dT%H:%M:%S")
    except ValueError:
        # Fallback to direct use if parsing fails
        start_str = start_date
        end_str = end_date

        # ÖNEMLİ: API'nin beklediği TÜM alanlar (Null olsa bile gönderilmeli)
        body = {
            "BetId": None,
            "CalcEndDateLocal": None,
            "CalcStartDateLocal": None,
            "ClientId": client_id,
            "CurrencyId": "TRY",
            "EndDateLocal": end_str,
            "IsBonusBet": None,
            "IsLive": None,
            "MaxRows": 50,
            "SkeepRows": 0,
            "StartDateLocal": start_str,
            "State": None, 
            "ToCurrencyId": "TRY"
        }
        
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(settings.BAPI_BET_HISTORY_URL, headers=get_headers(), json=body)
            r.raise_for_status()
            data = r.json()
            
            # --- Parsing Logic Verified with Raw Response ---
            # Structure: Data -> BetData -> Objects (List of bets)
            if "Data" in data and isinstance(data["Data"], dict):
                inner_data = data["Data"]
                if "BetData" in inner_data and isinstance(inner_data["BetData"], dict):
                     return { "Bets": inner_data["BetData"].get("Objects", []) }

            # Fallback patterns
            if "BetData" in data:
                bet_data = data["BetData"]
                if isinstance(bet_data, dict):
                     return { "Bets": bet_data.get("Objects", []) }
            
            if "Data" in data:
                return data["Data"]
                
            return data
    except Exception as e:
        logger.error(f"Error fetching bet history for {client_id}: {e}")
        return {}

async def fetch_bet_selections(bet_id: str) -> Dict[str, Any]:
    """Betconstruct'tan bahis seçim detaylarını çeker."""
    body = {
        "BetId": bet_id
    }
    
    try:
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
    except Exception as e:
        logger.error(f"Error fetching bet selections for {bet_id}: {e}")
        return {}

def get_date_range():
    """Worker için varsayılan tarih aralığını döner (Son 48 saat)."""
    end = datetime.utcnow()
    start = end - timedelta(days=2)
    return start.strftime("%Y-%m-%dT%H:%M:%SZ"), end.strftime("%Y-%m-%dT%H:%M:%SZ")
