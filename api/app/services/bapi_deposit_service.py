import httpx
from datetime import date
from calendar import monthrange
from typing import Optional
from common.settings import settings



def get_headers():
    """Betconstruct API istekleri için header'ları hazırlar."""
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
    }
    
    # BAPI_TOKEN set edilmişse ekle
    if settings.BAPI_TOKEN:
        headers["Authentication"] = settings.BAPI_TOKEN
    
    return headers


async def fetch_client_id_by_login(login: str) -> Optional[int]:
    """
    Kullanıcı adını (login) kullanarak Betconstruct'tan client ID çeker.
    
    Returns:
        Client ID bulunursa int, bulunamazsa None
    """
    body = {
        "Login": login,
        "MaxRows": 1
    }

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(settings.BAPI_CLIENT_INFO_URL, headers=get_headers(), json=body)
        r.raise_for_status()
        data = r.json()

    data_field = data.get("Data") or {}
    users = data_field.get("Objects") or []
    if not users:
        return None

    return users[0].get("Id")


def get_current_month_range():
    today = date.today()
    first_day = today.replace(day=1)
    last_day = today.replace(day=monthrange(today.year, today.month)[1])
    return first_day, last_day


async def has_single_deposit_1000(client_id: int) -> bool:
    start, end = get_current_month_range()

    body = {
        "ClientId": client_id,
        "CurrencyId": "TRY",
        "StartTimeLocal": start.strftime("%d-%m-%Y"),
        "EndTimeLocal": end.strftime("%d-%m-%Y"),
        "DocumentTypeIds": [3],
        "MaxRows": 20,
        "SkipRows": 0,
        "ByPassTotals": False
    }

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(settings.BAPI_DEPOSIT_URL, headers=get_headers(), json=body)
        r.raise_for_status()
        data = r.json()

    data_field = data.get("Data") or {}
    items = data_field.get("Objects") or []
    return any(x.get("Amount", 0) >= 1000 for x in items)
