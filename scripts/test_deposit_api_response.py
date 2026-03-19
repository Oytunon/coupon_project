"""
Deposit API response yapısını test et - Id, duplicate var mı?
"""
import asyncio
import json
from datetime import datetime, timedelta, timezone

from shared.services.deposit_report import fetch_deposits_bulk, _to_bc_local_format


async def main():
    # Son 1 saat - az veri gelsin
    now = datetime.now(timezone.utc)
    from_dt = now - timedelta(hours=1)
    to_dt = now

    print("=" * 60)
    print("Deposit API Test - Response yapısı ve duplicate kontrolü")
    print("=" * 60)
    print(f"Tarih aralığı: {from_dt} -> {to_dt}")
    print()

    docs = await fetch_deposits_bulk(from_dt=from_dt, to_dt=to_dt, max_rows=50, page_delay=1.0)

    if not docs:
        print("Hiç deposit gelmedi.")
        return

    # İlk doc'un tüm key'leri (deposit_report sadece client_id, amount, created_utc alıyor - raw API'de daha fazla var mı?)
    # fetch_deposits_bulk raw obj'den sadece 3 alan alıyor. Raw response'u görmek için deposit_report'u geçici değiştirelim
    # veya tek sayfa çekip raw obj'leri yazdıralım.

    # Tek sayfa manuel çek - raw response görelim
    import httpx
    from shared.settings import settings
    from shared.services.betconstruct import get_headers

    from_str = _to_bc_local_format(from_dt)
    to_str = _to_bc_local_format(to_dt)
    body = {
        "AmountFrom": "",
        "AmountTo": "",
        "ByPassTotals": False,
        "CashDeskId": "",
        "ClientId": "",
        "CurrencyId": "",
        "DefaultCurrencyId": "TRY",
        "ExternalId": "",
        "FromCreatedDateLocal": from_str,
        "FromTransactionDateLocal": "",
        "Id": "",
        "IsOrderedDesc": True,
        "IsTest": "false",
        "MaxRows": 100,
        "OrderedItem": 1,
        "PaymentSystemId": None,
        "RegionId": None,
        "SkeepRows": 0,
        "ToCreatedDateLocal": to_str,
        "ToTransactionDateLocal": "",
    }

    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(
            settings.BAPI_DEPOSIT_REPORT_URL,
            headers=get_headers(),
            json=body,
        )
        r.raise_for_status()
        data = r.json()

    docs_data = (data.get("Data") or {}).get("Documents") or {}
    objects = docs_data.get("Objects") or []
    count = docs_data.get("Count") or 0

    # Sadece TypeId=3 (Deposit) olanlar
    deposits = [o for o in objects if o.get("TypeId") == 3]

    print(f"Sayfa 1: Toplam {len(objects)} object, {len(deposits)} deposit, Count={count}")
    print()

    if deposits:
        # İlk deposit objesinin TÜM key'leri
        sample = deposits[0]
        print("İlk deposit objesi - TÜM KEY'LER:")
        for k, v in sorted(sample.items()):
            print(f"  {k}: {v}")
        print()

        # Id var mı?
        has_id = "Id" in sample or "id" in sample
        print(f"Transaction Id var mı? {has_id}")
        if "Id" in sample:
            print(f"  Id değeri: {sample['Id']}")
        if "id" in sample:
            print(f"  id değeri: {sample['id']}")
        print()

        # Duplicate kontrolü - (ClientId, Amount, CreatedLocal) veya Id ile
        keys_used = []
        if "Id" in sample and sample["Id"]:
            keys_used.append("Id")
        elif "id" in sample and sample["id"]:
            keys_used.append("id")
        else:
            keys_used.append("(ClientId, Amount, CreatedLocal)")

        seen = set()
        dupes = []
        for d in deposits:
            if "Id" in d and d["Id"]:
                key = ("Id", d["Id"])
            elif "id" in d and d["id"]:
                key = ("id", d["id"])
            else:
                key = ("composite", d.get("ClientId"), d.get("Amount"), d.get("CreatedLocal"))
            if key in seen:
                dupes.append(d)
            seen.add(key)

        print(f"Duplicate kontrolü ({keys_used}): {len(dupes)} duplicate bulundu")
        if dupes:
            print("Duplicate örnekleri:")
            for d in dupes[:3]:
                print(f"  {d}")
        print()

        # fetch_deposits_bulk'tan gelen docs - duplicate var mı?
        print("fetch_deposits_bulk sonucu - docs içinde duplicate:")
        doc_keys = [(d["client_id"], d["amount"], str(d.get("created_utc"))) for d in docs]
        from collections import Counter
        counts = Counter(doc_keys)
        dupes_docs = [(k, c) for k, c in counts.items() if c > 1]
        print(f"  {len(dupes_docs)} duplicate key (client_id, amount, created_utc)")
        if dupes_docs:
            for k, c in dupes_docs[:5]:
                print(f"    {k} -> {c} kez")


if __name__ == "__main__":
    asyncio.run(main())
