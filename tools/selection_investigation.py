import asyncio
import os
import sys
import httpx
import json

# Add root directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from common.settings import settings
from worker.services.betconstruct import get_headers

async def selection_investigation(bet_id: int):
    url = "https://backofficewebadmin.betconstruct.com/api/en/Sport/GetBetSelections"
    
    print(f"🔍 Investigating Selections for Bet ID: {bet_id}")
    
    body = {
        "BetId": bet_id
    }
    
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            r = await client.post(url, headers=get_headers(), json=body)
            print(f"Status: {r.status_code}")
            data = r.json()
            
            print("--- RAW SELECTIONS RESPONSE START ---")
            print(json.dumps(data, indent=2))
            print("--- RAW SELECTIONS RESPONSE END ---")
            
        except Exception as e:
            print(f"❌ API Error: {str(e)}")

if __name__ == "__main__":
    # Use one of the bet ids found earlier
    asyncio.run(selection_investigation(5901047560))
