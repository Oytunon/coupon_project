import asyncio
import os
import sys
from datetime import datetime, timedelta

# Add root directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from worker.services.betconstruct import fetch_bet_history
from common.settings import settings

async def diagnostic_coupon_fetch(username: str, client_id: int):
    print(f"--- Diagnostic Coupon Fetch for: {username} (ID: {client_id}) ---")
    
    # Check last 30 days
    end_date_obj = datetime.now()
    start_date_obj = end_date_obj - timedelta(days=30)
    
    # Format: "DD-MM-YY - HH:MM:SS"
    start_date = start_date_obj.strftime("%d-%m-%y - %H:%M:%S")
    end_date = end_date_obj.strftime("%d-%m-%y - %H:%M:%S")
    
    print(f"📅 Checking period: {start_date} to {end_date}")
    
    try:
        bet_history_data = await fetch_bet_history(
            client_id=client_id,
            start_date=start_date,
            end_date=end_date
        )
        
        bets = bet_history_data.get("Data", {}).get("Objects", []) or bet_history_data.get("Bets", [])
        print(f"📦 Total coupons found in 30 days: {len(bets)}")
        
        for i, bet in enumerate(bets[:5]): # Show first 5
            bid = bet.get("BetId")
            stake = bet.get("EquivalentAmount")
            ctype = bet.get("Type")
            print(f"  [{i+1}] BetID: {bid}, Stake: {stake}, Type: {ctype}")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(diagnostic_coupon_fetch("cengizcagin", 1043017727))
