
from shared.database import SessionLocal
from shared.models.coupon import Coupon
from datetime import datetime, timedelta

# API'deki tarihler TR saati (UTC+3). UTC'ye çevirmek için -3 saat.
TR_TO_UTC = timedelta(hours=-3)


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
                
            # CalcDateLocal = sonuçlanma saati (TR). CreatedAt da TR olabilir.
            raw = bet_data.get("CalcDateLocal") or bet_data.get("CreatedAt") or bet_data.get("Created") or bet_data.get("CreatedLocal")
            
            if raw:
                try:
                    clean = str(raw).split('.')[0].replace("Z", "")
                    if "+" in clean:
                        clean = clean.split("+")[0]
                    
                    if "T" in clean:
                        dt_tr = datetime.strptime(clean, "%Y-%m-%dT%H:%M:%S")
                    else:
                        dt_tr = datetime.strptime(clean, "%Y-%m-%d %H:%M:%S")
                    
                    # TR saati -> UTC (created_at UTC olarak saklanmalı)
                    dt_utc = dt_tr + TR_TO_UTC
                    
                    if c.created_at != dt_utc:
                        print(f"Updating Coupon {c.bet_id}: {c.created_at} -> {dt_utc} (TR: {dt_tr})")
                        c.created_at = dt_utc
                        updated_count += 1
                except Exception as e:
                    print(f"Error parsing date for coupon {c.bet_id}: {raw} -> {e}")
        
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
