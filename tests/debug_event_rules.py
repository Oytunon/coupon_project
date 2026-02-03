from shared.database import SessionLocal
from shared.models.event import Event
import json

def main():
    db = SessionLocal()
    try:
        events = db.query(Event).filter(Event.is_active == True).all()
        print(f"Found {len(events)} active events.")
        
        for e in events:
            print(f"\nEvent ID: {e.id} | Name: {e.name}")
            rules = e.rules or {}
            print(f"Rules: {json.dumps(rules, indent=2)}")
            formula = rules.get("scoring_formula", "simple")
            print(f"-> Effective Formula: {formula}")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
