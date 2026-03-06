import asyncio
import os
import sys
import httpx
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

BAPI_TOKEN = os.getenv("BAPI_TOKEN")

async def test_max_rows(client_id: int, max_rows: int):
    print(f"\n--- Testing MaxRows={max_rows} for client {client_id} ---")
    headers = {
        "Content-Type": "application/json;charset=UTF-8"
    }
    if BAPI_TOKEN:
        headers["Authentication"] = BAPI_TOKEN
    
    # 3 aylik genis bir aralik
    body = {
        "BetId": None,
        "CalcEndDateLocal": "2026-03-04T23:59:59",
        "CalcStartDateLocal": "2024-01-01T00:00:00",
        "ClientId": client_id,
        "CurrencyId": "TRY",
        "EndDateLocal": None,
        "IsBonusBet": None,
        "IsLive": None,
        "MaxRows": max_rows,
        "SkeepRows": 0,
        "StartDateLocal": None,
        "State": None,
        "ToCurrencyId": "TRY"
    }
    
    url = "https://backofficewebadmin.betconstruct.com/api/en/Report/GetBetHistory"
    
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=body, headers=headers)
            print(f"Status Code: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                bets = data.get("Bets", []) or data.get("Data", []) or data.get("Objects", [])
                print(f"Success! Retrieved {len(bets)} bets.")
                return len(bets)
            else:
                print(f"Failed. Response: {resp.text[:200]}")
                return -1
    except Exception as e:
        print(f"Error: {e}")
        return -1


async def main():
    if not BAPI_TOKEN:
        print("BAPI_TOKEN not found in .env")
        return
        
    client_id_to_test = 145923278  # aktif bir test kullanicisi, buradan cok kupon donmeli
    
    test_values = [50, 100, 200, 250, 500, 1000]
    
    for val in test_values:
        await test_max_rows(client_id_to_test, val)
        await asyncio.sleep(2)  # rate limit'e karsi

if __name__ == "__main__":
    asyncio.run(main())
