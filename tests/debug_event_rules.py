from shared.database import SessionLocal
from shared.models.event import Event
import json

def main():
    db = SessionLocal()
    try:
        events = db.query(Event).all()
        print(f"Found {len(events)} TOTAL events in DB.")
        
        for e in events:
            print(f"\n==========================================")
            print(f"Event ID: {e.id}")
            print(f"Name: {e.name}")
            print(f"Active: {e.is_active}")
            print(f"Dates: {e.start_date} -> {e.end_date}")
            
            rules = e.rules or {}
            print(f"Rules JSON: {json.dumps(rules, indent=2)}")
            
            formula = rules.get("scoring_formula", "simple")
            print(f"-> Effective Formula: {formula}")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
