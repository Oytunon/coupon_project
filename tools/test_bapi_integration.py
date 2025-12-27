import asyncio
import os
import sys

# Add root directory to sys.path to allow imports from common and api
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from api.app.services.bapi_deposit_service import fetch_client_id_by_login, has_single_deposit_1000
from common.settings import settings

async def test_bapi_flow(username: str):
    print(f"--- B-API Integration Test for: {username} ---")
    
    # 1. Fetch Client ID
    print(f"[1/2] Fetching Client ID for '{username}'...")
    client_id = await fetch_client_id_by_login(username)
    
    if client_id is None:
        print(f"❌ Error: Could not find Client ID for username '{username}'. Check if the username is correct or if BAPI_TOKEN is valid.")
        return
    
    print(f"✅ Success: Client ID found: {client_id}")
    
    # 2. Check Deposit Status
    print(f"[2/2] Checking if user {client_id} has a single deposit >= 1000 TL this month...")
    try:
        eligible = await has_single_deposit_1000(client_id)
        
        if eligible:
            print(f"✅ Success: User {username} (ID: {client_id}) IS eligible (found deposit >= 1000 TL).")
        else:
            print(f"❌ Result: User {username} (ID: {client_id}) is NOT eligible (no single deposit >= 1000 TL found).")
    except Exception as e:
        print(f"❌ Error during deposit check: {str(e)}")
        # If we had a way to get the last response we would print it here.
        # But since we are calling the service function, we'll rely on the fix above.


if __name__ == "__main__":
    test_user = "cengizcagin"
    if len(sys.argv) > 1:
        test_user = sys.argv[1]
    
    asyncio.run(test_bapi_flow(test_user))
