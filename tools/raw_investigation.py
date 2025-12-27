import asyncio
import os
import sys
import httpx
import json
from datetime import datetime, timedelta

# Add root directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from common.settings import settings
from worker.services.betconstruct import get_headers

async def raw_investigation(client_id: int):
    url = "https://backofficewebadmin.betconstruct.com/api/en/Report/GetBetHistory"
    
    # Use very broad parameters
    # Start: 3 days ago, End: Tomorrow
    today = datetime.now()
    start = (today - timedelta(days=3)).strftime("%d-%m-%Y - 00:00:00")
    end = (today + timedelta(days=1)).strftime("%d-%m-%Y - 00:00:00")
    
    print(f"🔍 Investigating Client ID: {client_id}")
    print(f"📅 Range: {start} to {end}")
    
    body = {
        "ClientId": client_id,
        "CurrencyId": "TRY",
        "StartDateLocal": start,
        "EndDateLocal": end,
        "MaxRows": 100,
        "SkeepRows": 0,
        "ToCurrencyId": "TRY"
    }
    
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            r = await client.post(url, headers=get_headers(), json=body)
            print(f"Status: {r.status_code}")
            data = r.json()
            
            # Print the WHOLE response or a significant chunk
            print("--- RAW API RESPONSE START ---")
            print(json.dumps(data, indent=2))
            print("--- RAW API RESPONSE END ---")
            
        except Exception as e:
            print(f"❌ API Error: {str(e)}")

if __name__ == "__main__":
    # Ensure we use the right client id
    asyncio.run(raw_investigation(1043017727))
