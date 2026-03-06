import asyncio
import os
import sys
import httpx
from datetime import datetime
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

BAPI_TOKEN = os.getenv("BAPI_TOKEN")

async def test_dump(client_id: int):
    print(f"\n--- Testing MaxRows=50 for client {client_id} ---")
    headers = {
        "Content-Type": "application/json;charset=UTF-8"
    }
    if BAPI_TOKEN:
        headers["Authentication"] = BAPI_TOKEN
    
    # Let's hit the same time window the worker would have used based on the logs
    body = {
        "BetId": None,
        "CalcEndDateLocal": "2026-03-04T23:59:59",
        "CalcStartDateLocal": "2026-03-03T00:00:00",
        "ClientId": client_id,
        "CurrencyId": "TRY",
        "EndDateLocal": None,
        "IsBonusBet": None,
        "IsLive": None,
        "MaxRows": 50,
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
                
                # Dump to file
                output_file = f"dump_client_{client_id}.txt"
                with open(output_file, "w", encoding="utf-8") as f:
                    f.write(f"Client ID: {client_id}\n")
                    f.write(f"Total Bets in this single request (MaxRows=50): {len(bets)}\n\n")
                    for i, bet in enumerate(bets):
                        f.write(f"--- Bet {i+1} ---\n")
                        f.write(f"Bet ID: {bet.get('BetId') or bet.get('Id')}\n")
                        f.write(f"Created At: {bet.get('CreatedAt') or bet.get('Created')}\n")
                        f.write(f"Amount: {bet.get('Amount')}\n")
                        f.write(f"State: {bet.get('StateName')}\n\n")
                
                print(f"Saved details to {output_file}")
            else:
                print(f"Failed. Response: {resp.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")

async def main():
    if not BAPI_TOKEN:
        print("BAPI_TOKEN not found in .env")
        return
        
    client_id_to_test = 145923278 
    await test_dump(client_id_to_test)

if __name__ == "__main__":
    asyncio.run(main())
