import httpx
from datetime import datetime, timedelta
from typing import Optional
from common.settings import settings




def get_headers():
    """Betconstruct API istekleri için header'ları hazırlar."""
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
    }
    
    if settings.BAPI_TOKEN:
        headers["Authentication"] = settings.BAPI_TOKEN
    
    return headers


def get_date_range() -> tuple[str, str]:
    """
    Dünün 00:00'ından bugünün 00:00'ına kadar tarih aralığını döndürür.
    Format: "DD-MM-YY - HH:MM:SS"
    """
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    
    # Format: "DD-MM-YY - HH:MM:SS"
    start_date = yesterday.strftime("%d-%m-%y - %H:%M:%S")
    end_date = today.strftime("%d-%m-%y - %H:%M:%S")

    
    return start_date, end_date


async def fetch_bet_history(client_id: int, start_date: str, end_date: str, skip: int = 0, max_rows: int = 100) -> dict:
    """
    GetBetHistory API'sini kullanarak kullanıcının kupon geçmişini çeker.
    
    Args:
        client_id: Betconstruct client ID
        start_date: Başlangıç tarihi (format: "DD-MM-YY - HH:MM:SS")
        end_date: Bitiş tarihi (format: "DD-MM-YY - HH:MM:SS")
        skip: Atlanacak kayıt sayısı
        max_rows: Maksimum döndürülecek kayıt sayısı
    
    Returns:
        API yanıtı (dict)
    """
    body = {
        "BetId": None,
        "CalcEndDateLocal": None,
        "CalcStartDateLocal": None,
        "ClientId": client_id,
        "CurrencyId": "TRY",
        "EndDateLocal": end_date,
        "IsBonusBet": None,
        "IsLive": None,
        "MaxRows": max_rows,
        "SkeepRows": skip,  
        "StartDateLocal": start_date,
        "State": None,
        "ToCurrencyId": "TRY"
    }

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            settings.BAPI_BET_HISTORY_URL,
            headers=get_headers(),
            json=body
        )
        r.raise_for_status()
        return r.json()


async def fetch_bet_selections(bet_id: int) -> Optional[dict]:
    """
    GetBetSelections API'sini kullanarak kupon detaylarını çeker.
    
    Args:
        bet_id: Betconstruct bet ID
    
    Returns:
        API yanıtı (dict) veya None (hata durumunda)
    """
    body = {
        "BetId": bet_id
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                settings.BAPI_BET_SELECTIONS_URL,
                headers=get_headers(),
                json=body
            )
            r.raise_for_status()
            return r.json()
    except Exception as e:
        return None
