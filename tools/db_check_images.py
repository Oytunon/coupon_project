
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
    print("Checking events table for image_url...")
    result = conn.execute(text("SELECT id, name, slug, image_url FROM events"))
    rows = result.fetchall()
    
    if not rows:
        print("No events found.")
    else:
        for row in rows:
            print(f"ID: {row[0]} | Name: {row[1]} | Slug: {row[2]} | Image URL: {row[3]}")
