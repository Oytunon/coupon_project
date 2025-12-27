import sys
import os
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from common.models.participant import Participant
from common.models.coupon import Coupon
from common.database import Base

# Database connection
from common.settings import settings
# print(f"DEBUG: DATABASE_URL={settings.DATABASE_URL}")
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Ensure tables exist
Base.metadata.create_all(bind=engine)

def seed_data():
    username = "testuser"
    client_id = 12345
    
    # 1. Check/Add Participant
    participant = db.query(Participant).filter(Participant.username == username).first()
    if not participant:
        print(f"Creating participant: {username}")
        participant = Participant(username=username, client_id=client_id)
        db.add(participant)
        db.commit()
    else:
        print(f"Participant {username} already exists.")

    # 2. Add Mock Coupon
    bet_id = "999999"
    coupon = db.query(Coupon).filter(Coupon.bet_id == bet_id).first()
    if not coupon:
        print(f"Creating mock coupon for {username}")
        coupon = Coupon(
            client_id=client_id,
            bet_id=bet_id,
            created_at=datetime.now(),
            stake=100.0,
            odds=5.50,
            combination_count=3,
            is_live=False,
            state="won",
            winning=550.0,
            calculation=True
        )
        db.add(coupon)
        db.commit()
        print("Mock coupon created successfully.")
    else:
        print(f"Coupon {bet_id} already exists.")

    db.close()

if __name__ == "__main__":
    seed_data()
