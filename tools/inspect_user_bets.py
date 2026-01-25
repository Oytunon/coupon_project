import asyncio
import json
import logging
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from shared.services.betconstruct import fetch_bet_history, fetch_bet_selections, get_date_range

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CLIENT_ID = 571609473

async def inspect():
    print(f"--- Fecthing Bet History for Client: {CLIENT_ID} ---")
    
    # Get last 30 days to ensure we find some bets
    from datetime import datetime, timedelta
    end = datetime.utcnow()
    start = end - timedelta(days=365) # Last 365 days
    start_str = start.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_str = end.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    print(f"Fetching from {start_str} to {end_str}")
    bet_history = await fetch_bet_history(CLIENT_ID, start_str, end_str)
    
    print("\n[RAW RESPONSE SUMMARY]")
    # Dump full response to file for safe keeping and analysis
    with open("inspect_output.txt", "w", encoding="utf-8") as f:
        f.write(json.dumps(bet_history, indent=2, default=str))
    
    print(f"Response keys: {bet_history.keys() if isinstance(bet_history, dict) else 'Not a dict'}")
    
    if not bet_history:
        print("No bet history found (Empty response).")
        return

    # Handle BetData.Objects structure
    bets = bet_history.get("Bets", [])
    if not bets and "BetData" in bet_history:
        bets = bet_history["BetData"].get("Objects", [])

    print(f"Found {len(bets)} bets.")
    
    if not bets:
        return

    # Take the first bet to inspect
    sample_bet = bets[0]
    bet_id = sample_bet.get("BetId") or sample_bet.get("Id")
    
    print("\n[SAMPLE BET JSON]")
    print(json.dumps(sample_bet, indent=2))
    
    if bet_id:
        print(f"\n--- Fetching Selections for BetId: {bet_id} ---")
        selections_data = await fetch_bet_selections(str(bet_id))
        
        print("\n[SELECTIONS JSON]")
        # Dump selections to file
        with open("inspect_selections.txt", "w", encoding="utf-8") as f:
            f.write(json.dumps(selections_data, indent=2, default=str))
        
        # Analyze structure for League/Competition info
        print("\n--- ANALYSIS ---")
        
        selections_list = []
        if isinstance(selections_data, list):
            selections_list = selections_data
        elif isinstance(selections_data, dict):
            selections_list = selections_data.get("Data", []) or selections_data.get("Selections", [])

        if selections_list:
             print(f"Found {len(selections_list)} selections.")
             for idx, sel in enumerate(selections_list):
                 comp_id = sel.get("CompetitionId") # Look for CompetitionId here
                 comp_name = sel.get("CompetitionName")
                 market_name = sel.get("MarketName")
                 print(f"Selection #{idx+1}: CompetitionId={comp_id}, CompetitionName='{comp_name}', Market='{market_name}'")
        else:
            print("Could not extract selections list from response.")

if __name__ == "__main__":
    asyncio.run(inspect())
