import asyncio
import os
import sys
import httpx
from datetime import datetime, timedelta

# Add root directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from common.settings import settings
from worker.services.betconstruct import get_headers

async def verbose_diagnostic(client_id: int):
    url = "https://backofficewebadmin.betconstruct.com/api/en/Report/GetBetHistory"
    
    # Try multiple date formats
    formats = [
        "%d-%m-%y - %H:%M:%S",
        "%d-%m-%Y - %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%d.%m.%Y %H:%M:%S"
    ]
    
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today_start - timedelta(days=1)
    tomorrow = today_start + timedelta(days=1)
    
    for fmt in formats:
        start_date = yesterday.strftime(fmt)
        end_date = tomorrow.strftime(fmt)
        
        print(f"\n--- Testing Format: {fmt} ---")
        print(f"📅 Range: {start_date} to {end_date}")
        
        body = {
            "BetId": None,
            "CalcEndDateLocal": None,
            "CalcStartDateLocal": None,
            "ClientId": client_id,
            "CurrencyId": "TRY",
            "EndDateLocal": end_date,
            "IsBonusBet": None,
            "IsLive": None,
            "MaxRows": 20,
            "SkeepRows": 0,
            "StartDateLocal": start_date,
            "State": None,
            "ToCurrencyId": "TRY"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(url, headers=get_headers(), json=body)
                print(f"Status: {r.status_code}")
                data = r.json()
                
                # Check different response structures
                bets = data.get("Data", {}).get("Objects", []) or data.get("Bets", []) or data.get("Data", [])
                
                if isinstance(bets, list):
                    print(f"📦 Found {len(bets)} bets.")
                    if bets:
                        print("Sample Bet:", bets[0])
                        return # Found something, exit
                else:
                    print("Unexpected response structure:", data)
                    
        except Exception as e:
            print(f"❌ Error with format {fmt}: {str(e)}")

if __name__ == "__main__":
    asyncio.run(verbose_diagnostic(1043017727))
