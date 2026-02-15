
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found in .env")
    exit(1)

engine = create_engine(db_url)

with engine.connect() as conn:
    print("Checking leagues table count...")
    result = conn.execute(text("SELECT count(*) FROM leagues"))
    count = result.scalar()
    print(f"Total leagues: {count}")
    
    if count > 0:
        print("First 5 leagues:")
        result = conn.execute(text("SELECT id, name, sport_id FROM leagues LIMIT 5"))
        for row in result:
            print(row)
