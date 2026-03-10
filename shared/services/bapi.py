import httpx
from datetime import date, datetime, timedelta
from calendar import monthrange
from typing import Optional
from shared.settings import settings
from shared.exceptions import BAPIRateLimitError

# GetClients rate limit cooldown (Betconstruct: "try after 2min")
_get_clients_cooldown_until = None


def _is_get_clients_rate_limited() -> bool:
    global _get_clients_cooldown_until
    if _get_clients_cooldown_until and datetime.utcnow() < _get_clients_cooldown_until:
        return True
    return False


def _set_get_clients_cooldown(seconds: int = 130):
    """2 dk cooldown (API 2min diyor, biraz fazla tutuyoruz)."""
    global _get_clients_cooldown_until
    _get_clients_cooldown_until = datetime.utcnow() + timedelta(seconds=seconds)


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
    Rate limit (403) gelirse BAPIRateLimitError fırlatır.
    
    Returns:
        Client ID bulunursa int, bulunamazsa None
    """
    if _is_get_clients_rate_limited():
        raise BAPIRateLimitError()

    body = {"Login": login, "MaxRows": 1}

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(settings.BAPI_CLIENT_INFO_URL, headers=get_headers(), json=body)
        if r.status_code == 403:
            _set_get_clients_cooldown(130)
            raise BAPIRateLimitError()
        try:
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                _set_get_clients_cooldown(130)
                raise BAPIRateLimitError() from e
            raise
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


async def has_single_deposit(client_id: int, min_amount: float = 1000) -> bool:
    try:
        min_amount = float(min_amount) if min_amount is not None else 0
    except (TypeError, ValueError):
        min_amount = 0

    if min_amount <= 0:
        return True
    start, end = get_current_month_range()

    body = {
        "ClientId": client_id,
        "CurrencyId": "TRY",
        "StartTimeLocal": start.strftime("%Y-%m-%dT00:00:00"),
        "EndTimeLocal": end.strftime("%Y-%m-%dT23:59:59"),
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
        print(f"DEBUG_BAPI_TRANSACTIONS: {data}")

    data_field = data.get("Data") or {}
    items = data_field.get("Objects") or []
    return any(x.get("Amount", 0) >= min_amount for x in items)
