import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from sqlalchemy import create_engine, text
from shared.settings import settings

def reset_db():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("Cleaning up database...")
        # Order matters due to foreign keys
        conn.execute(text("TRUNCATE TABLE coupons CASCADE"))
        conn.execute(text("TRUNCATE TABLE event_participants CASCADE"))
        conn.execute(text("TRUNCATE TABLE participants CASCADE"))
        conn.execute(text("TRUNCATE TABLE events CASCADE"))
        conn.commit()
        print("Database cleared successfully.")

if __name__ == "__main__":
    reset_db()
