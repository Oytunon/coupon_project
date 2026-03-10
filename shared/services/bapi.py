import httpx
from datetime import date, datetime, timedelta
from calendar import monthrange
from typing import Optional
from shared.settings import settings
from shared.exceptions import BAPIRateLimitError

# GetClients rate limit cooldown (Betconstruct: "try after 2min")
_get_clients_cooldown_until = None

# Başarılı sonuç cache: login -> (client_id, expires_at) — aynı kullanıcı tekrar istek atarsa BAPI çağrılmaz
_client_id_cache: dict[str, tuple[int, datetime]] = {}
_CLIENT_CACHE_TTL_SEC = 300  # 5 dk

# Proaktif throttling: istekler arası min 4 sn — 403 almadan önce kendimiz sınırlıyoruz
_get_clients_last_request_at: datetime | None = None
_GET_CLIENTS_MIN_INTERVAL_SEC = 4


def _get_remaining_cooldown_seconds() -> int:
    """Kalan cooldown süresi (sn). 0 ise cooldown yok."""
    global _get_clients_cooldown_until
    if not _get_clients_cooldown_until:
        return 0
    delta = (_get_clients_cooldown_until - datetime.utcnow()).total_seconds()
    return max(0, int(delta))


def _is_get_clients_rate_limited() -> bool:
    global _get_clients_cooldown_until
    if _get_clients_cooldown_until and datetime.utcnow() < _get_clients_cooldown_until:
        return True
    return False


def _set_get_clients_cooldown(seconds: int = 130):
    """2 dk cooldown (API 2min diyor, biraz fazla tutuyoruz)."""
    global _get_clients_cooldown_until
    _get_clients_cooldown_until = datetime.utcnow() + timedelta(seconds=seconds)


def _can_make_get_clients_request() -> bool:
    """Proaktif: son istekten bu yana 4 sn geçmediyse False."""
    global _get_clients_last_request_at
    if _get_clients_last_request_at is None:
        return True
    elapsed = (datetime.utcnow() - _get_clients_last_request_at).total_seconds()
    return elapsed >= _GET_CLIENTS_MIN_INTERVAL_SEC


def _record_get_clients_request():
    global _get_clients_last_request_at
    _get_clients_last_request_at = datetime.utcnow()


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
    Cache + proaktif throttling ile BAPI çağrı sayısı azaltılır.
    
    Returns:
        Client ID bulunursa int, bulunamazsa None
    """
    # 1. Cache kontrolü — aynı kullanıcı son 5 dk içinde sorgulandıysa BAPI çağrılmaz
    now = datetime.utcnow()
    if login in _client_id_cache:
        cid, expires = _client_id_cache[login]
        if now < expires:
            return cid
        del _client_id_cache[login]

    if _is_get_clients_rate_limited():
        sec = _get_remaining_cooldown_seconds() or 130
        raise BAPIRateLimitError(retry_after_seconds=sec)
    if not _can_make_get_clients_request():
        _set_get_clients_cooldown(_GET_CLIENTS_MIN_INTERVAL_SEC)
        raise BAPIRateLimitError(retry_after_seconds=_GET_CLIENTS_MIN_INTERVAL_SEC)

    body = {"Login": login, "MaxRows": 1}

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(settings.BAPI_CLIENT_INFO_URL, headers=get_headers(), json=body)
        if r.status_code == 403:
            _set_get_clients_cooldown(130)
            raise BAPIRateLimitError(retry_after_seconds=130)
        try:
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                _set_get_clients_cooldown(130)
                raise BAPIRateLimitError(retry_after_seconds=130) from e
            raise
        data = r.json()

    data_field = data.get("Data") or {}
    users = data_field.get("Objects") or []
    if not users:
        return None

    client_id = users[0].get("Id")
    if client_id is not None:
        _record_get_clients_request()
        _client_id_cache[login] = (client_id, now + timedelta(seconds=_CLIENT_CACHE_TTL_SEC))
    return client_id


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
