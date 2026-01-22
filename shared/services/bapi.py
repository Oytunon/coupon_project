import httpx
from datetime import date
from calendar import monthrange
from typing import Optional
from shared.settings import settings



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

    args = body
    args = body
    
    async with httpx.AsyncClient(timeout=20) as client:
        print(f"DEBUG_BAPI_ENV: URL={settings.BAPI_CLIENT_INFO_URL} TOKEN_START={settings.BAPI_TOKEN[:5] if settings.BAPI_TOKEN else 'None'}")
        r = await client.post(settings.BAPI_CLIENT_INFO_URL, headers=get_headers(), json=body)
        r.raise_for_status()
        data = r.json()
        print(f"DEBUG_BAPI_RESPONSE for {login}: {data}")

    data_field = data.get("Data") or {}
    users = data_field.get("Objects") or []
    if not users:
        print(f"DEBUG_BAPI_USERS for {login}: Users list is empty")
        return None

    client_id = users[0].get("Id")
    print(f"DEBUG_BAPI_ID for {login}: {client_id}")
    return client_id


def get_current_month_range():
    today = date.today()
    first_day = today.replace(day=1)
    last_day = today.replace(day=monthrange(today.year, today.month)[1])
    return first_day, last_day


async def has_single_deposit(client_id: int, min_amount: float = 1000) -> bool:
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

    # MOCK FOR TESTING
    # MOCK removed
    # if client_id == 12345:
    #    return True

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(settings.BAPI_DEPOSIT_URL, headers=get_headers(), json=body)
        r.raise_for_status()
        data = r.json()

    data_field = data.get("Data") or {}
    items = data_field.get("Objects") or []
    return any(x.get("Amount", 0) >= min_amount for x in items)
