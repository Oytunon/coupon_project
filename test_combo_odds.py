import sys
import asyncio
import json
from datetime import datetime, timedelta
import os

# Add project root to path so we can import shared modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.services.betconstruct import fetch_bet_history, fetch_bet_selections
from shared.settings import settings

async def test_client_combination_bets(client_id: int):
    print(f"Testing combination bets for Client ID: {client_id}")
    print(f"Using API KEY: {settings.BAPI_TOKEN[:5]}... (redacted)")
    
    # Check last 2 days to ensure we catch some combination bets
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=2)
    
    start_str = start_date.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_str = end_date.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    print(f"Fetching history from {start_str} to {end_str}...")
    
    # 1. Fetch bet history
    history = await fetch_bet_history(client_id, start_str, end_str)
    
    if not history or "Bets" not in history or not history["Bets"]:
        print("No bets found for this client.")
        return
        
    bets = history["Bets"]
    print(f"Found {len(bets)} total bets.")
    
    # 2. Filter for combination / multiple bets
    # Type 2 usually means Multiple/Combination in Betconstruct
    combo_bets = [b for b in bets if b.get('Type') == 2 or b.get('TypeName', '').lower() in ['multiple', 'combo', 'accumulator', 'kombine']]
    
    if not combo_bets:
        print("No combination bets found in the history. Looking at the first 3 bets of any type instead:")
        combo_bets = bets[:3]
    else:
        print(f"Found {len(combo_bets)} combination bets. Analyzing the first 3...")
        combo_bets = combo_bets[:3]
        
    for idx, bet in enumerate(combo_bets):
        # Betconstruct sometimes uses 'Id' instead of 'BetId' in the history payload
        bet_id = str(bet.get("Id") or bet.get("BetId"))
        bet_type = bet.get("Type")
        total_odds = bet.get("Price") or bet.get("Odds")
        stake = bet.get("Amount")
        
        print("\n" + "="*50)
        print(f"BET #{idx+1} | ID: {bet_id} | Type: {bet_type} | Total Odds: {total_odds} | Stake: {stake}")
        print("History Data Dump:")
        print(json.dumps(bet, indent=2))
        
        # 3. Fetch specific bet selections
        print(f"\n--- Fetching Selections for {bet_id} ---")
        selections = await fetch_bet_selections(bet_id)
        
        print("Selections Data Dump:")
        print(json.dumps(selections, indent=2))
        
        # Look for odds in selections
        if "Selections" in selections and isinstance(selections["Selections"], list):
            print("\nExtracted Selection Odds:")
            for s_idx, sel in enumerate(selections["Selections"]):
                sel_odds = sel.get("Price") or sel.get("Odds") or sel.get("Coefficient")
                sel_name = sel.get("SelectionName") or sel.get("EventName") or "Unknown Event"
                print(f"  Selection {s_idx+1}: {sel_name} -> Odds: {sel_odds}")
        else:
            print("\nCould not find 'Selections' list in the response.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_combo_odds.py <CLIENT_ID>")
        sys.exit(1)
        
    client_id = int(sys.argv[1])
    asyncio.run(test_client_combination_bets(client_id))
