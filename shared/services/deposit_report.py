"""
GetDepositsWithdrawalsWithPaging API servisi.
Katılımdan sonraki yatırımları (TypeId=3) çeker ve toplar.
Her çağrıda FULL RECALC: toplam yeniden hesaplanır, çift sayım olmaz.
"""
import httpx
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from shared.settings import settings
from shared.services.betconstruct import get_headers, _interruptible_sleep

logger = logging.getLogger(__name__)

# TypeId: 3 = Deposit
TYPE_ID_DEPOSIT = 3

# Pagination - 200: 504 timeout riskini azaltır
MAX_ROWS = 200
PAGE_DELAY_SEC = 4.0  # Sayfalar arası (rate limit)
REQUEST_TIMEOUT = 90  # 504 önleme
MAX_RETRIES = 3
RETRY_DELAY_SEC = 15


def _to_bc_local_format(dt: datetime) -> str:
    """Betconstruct Local (TR UTC+3) format: DD-MM-YY - HH:MM:SS"""
    tr_offset = timedelta(hours=3)
    if dt.tzinfo is None:
        local = dt + tr_offset
    else:
        local = dt.astimezone(timezone(timedelta(hours=3)))
    return local.strftime("%d-%m-%y - %H:%M:%S")


def _parse_created_local(s: str) -> Optional[datetime]:
    """CreatedLocal parse (2026-03-18T11:48:40.034) -> UTC datetime"""
    if not s:
        return None
    try:
        clean = str(s).split(".")[0].replace("Z", "").split("+")[0]
        parsed = datetime.strptime(clean, "%Y-%m-%dT%H:%M:%S")
        # API Local = TR UTC+3
        return (parsed - timedelta(hours=3)).replace(tzinfo=timezone.utc)
    except Exception:
        return None


async def fetch_deposits_bulk(
    from_dt: datetime,
    to_dt: datetime,
    http_client: Optional[httpx.AsyncClient] = None,
    page_delay: float = PAGE_DELAY_SEC,
) -> list[dict]:
    """
    Tüm yatırımları toplu çeker (ClientId boş). Pagination ile.
    Her item: {client_id, amount, created_utc}
    """
    from_str = _to_bc_local_format(from_dt)
    to_str = _to_bc_local_format(to_dt)
    all_docs = []
    skip_rows = 0
    own_client = http_client is None
    page_num = 0

    logger.info(f"[Deposit API] Toplu çekim başlıyor | Tarih: {from_str} -> {to_str}")

    if own_client:
        http_client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)

    try:
        while True:
            page_num += 1
            body = {
                "AmountFrom": "",
                "AmountTo": "",
                "ByPassTotals": False,
                "CashDeskId": "",
                "ClientId": "",  # Boş = tüm client'lar
                "CurrencyId": "",
                "DefaultCurrencyId": "TRY",
                "ExternalId": "",
                "FromCreatedDateLocal": from_str,
                "FromTransactionDateLocal": "",
                "Id": "",
                "IsOrderedDesc": True,
                "IsTest": "false",
                "MaxRows": MAX_ROWS,
                "OrderedItem": 1,
                "PaymentSystemId": None,
                "RegionId": None,
                "SkeepRows": skip_rows,
                "ToCreatedDateLocal": to_str,
                "ToTransactionDateLocal": "",
            }

            last_err = None
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    r = await http_client.post(
                        settings.BAPI_DEPOSIT_REPORT_URL,
                        headers=get_headers(),
                        json=body,
                    )
                    r.raise_for_status()
                    break
                except httpx.HTTPStatusError as e:
                    last_err = e
                    if e.response.status_code in (502, 503, 504) and attempt < MAX_RETRIES:
                        logger.warning(f"[Deposit API] Sayfa {page_num} {e.response.status_code}, {RETRY_DELAY_SEC}s sonra tekrar ({attempt}/{MAX_RETRIES})")
                        await _interruptible_sleep(RETRY_DELAY_SEC)
                    else:
                        raise
            data = r.json()

            if data.get("HasError"):
                logger.warning(f"[Deposit API] HasError: {data.get('AlertMessage', '')}")
                break

            docs = (data.get("Data") or {}).get("Documents") or {}
            objects = docs.get("Objects") or []
            count = docs.get("Count") or 0

            deposits_this_page = sum(1 for o in objects if o.get("TypeId") == TYPE_ID_DEPOSIT)
            logger.info(f"[Deposit API] Sayfa {page_num} | Gelen: {len(objects)} | Deposit: {deposits_this_page} | Toplam Count: {count}")
            if page_num == 1 and len(objects) > 0:
                sample = next((o for o in objects if o.get("TypeId") == TYPE_ID_DEPOSIT), objects[0])
                logger.info(f"[Deposit API] İlk örnek: ClientId={sample.get('ClientId')} Amount={sample.get('Amount')} CreatedLocal={sample.get('CreatedLocal')}")

            for obj in objects:
                if obj.get("TypeId") == TYPE_ID_DEPOSIT:
                    cid = obj.get("ClientId")
                    amt = float(obj.get("Amount", 0) or 0)
                    created = _parse_created_local(obj.get("CreatedLocal"))
                    if cid is not None:
                        all_docs.append({"client_id": cid, "amount": amt, "created_utc": created})

            if not objects or len(objects) < MAX_ROWS or skip_rows + len(objects) >= count:
                break

            skip_rows += MAX_ROWS
            await _interruptible_sleep(page_delay)

    finally:
        if own_client:
            await http_client.aclose()

    logger.info(f"[Deposit API] Tamamlandı | Toplam çekilen: {len(all_docs)} deposit kaydı")
    return all_docs


async def fetch_deposits_for_client(
    client_id: int,
    from_dt: datetime,
    to_dt: datetime,
    http_client: Optional[httpx.AsyncClient] = None,
    page_delay: float = PAGE_DELAY_SEC,
) -> float:
    """
    Belirli bir client için from_dt..to_dt aralığındaki toplam yatırım miktarını döner.
    TypeId=3 (Deposit) olanları toplar. Pagination ile tüm sayfaları çeker.
    REPLACE stratejisi: Her worker run'da bu toplam DB'ye yazılır, ekleme yapılmaz.
    """
    from_str = _to_bc_local_format(from_dt)
    to_str = _to_bc_local_format(to_dt)
    total = 0.0
    skip_rows = 0
    own_client = http_client is None

    if own_client:
        http_client = httpx.AsyncClient(timeout=60)

    try:
        while True:
            body = {
                "AmountFrom": "",
                "AmountTo": "",
                "ByPassTotals": False,
                "CashDeskId": "",
                "ClientId": str(client_id),
                "CurrencyId": "",
                "DefaultCurrencyId": "TRY",
                "ExternalId": "",
                "FromCreatedDateLocal": from_str,
                "FromTransactionDateLocal": "",
                "Id": "",
                "IsOrderedDesc": True,
                "IsTest": "false",
                "MaxRows": MAX_ROWS,
                "OrderedItem": 1,
                "PaymentSystemId": None,
                "RegionId": None,
                "SkeepRows": skip_rows,
                "ToCreatedDateLocal": to_str,
                "ToTransactionDateLocal": "",
            }

            r = await http_client.post(
                settings.BAPI_DEPOSIT_REPORT_URL,
                headers=get_headers(),
                json=body,
            )
            r.raise_for_status()
            data = r.json()

            if data.get("HasError"):
                logger.warning(f"Deposit API HasError for client {client_id}: {data.get('AlertMessage', '')}")
                break

            docs = (data.get("Data") or {}).get("Documents") or {}
            objects = docs.get("Objects") or []
            count = docs.get("Count") or 0

            for obj in objects:
                if obj.get("TypeId") == TYPE_ID_DEPOSIT:
                    total += float(obj.get("Amount", 0) or 0)

            if not objects or len(objects) < MAX_ROWS or skip_rows + len(objects) >= count:
                break

            skip_rows += MAX_ROWS
            await _interruptible_sleep(page_delay)

    except httpx.HTTPStatusError as e:
        if e.response.status_code in (403, 429):
            raise
        logger.warning(f"Deposit API HTTP error for client {client_id}: {e}")
    except Exception as e:
        logger.warning(f"Deposit fetch error for client {client_id}: {e}")
        raise
    finally:
        if own_client:
            await http_client.aclose()

    return round(total, 2)
