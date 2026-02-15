
from shared.database import SessionLocal
from shared.models.coupon import Coupon
from datetime import datetime
import json

def fix_dates():
    db = SessionLocal()
    try:
        coupons = db.query(Coupon).all()
        print(f"Checking {len(coupons)} coupons...")
        updated_count = 0
        
        for c in coupons:
            bet_data = c.bet_data
            if not bet_data:
                continue
                
            # Possible date fields in bet_data
            raw_created = bet_data.get("CreatedAt") or bet_data.get("Created") or bet_data.get("CreatedLocal")
            
            if raw_created:
                try:
                    # Clean up common ISO variations
                    clean_created = str(raw_created).split('.')[0].replace("Z", "")
                    if "+" in clean_created: clean_created = clean_created.split("+")[0]
                    
                    if "T" in clean_created:
                        dt = datetime.strptime(clean_created, "%Y-%m-%dT%H:%M:%S")
                    else:
                        dt = datetime.strptime(clean_created, "%Y-%m-%d %H:%M:%S")
                    
                    if c.created_at != dt:
                        print(f"Updating Coupon {c.bet_id}: {c.created_at} -> {dt}")
                        c.created_at = dt
                        updated_count += 1
                except Exception as e:
                    print(f"Error parsing date for coupon {c.bet_id}: {raw_created} -> {e}")
        
        if updated_count > 0:
            db.commit()
            print(f"Successfully updated {updated_count} coupons.")
        else:
            print("No updates needed.")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_dates()
