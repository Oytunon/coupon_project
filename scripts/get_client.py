import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from shared.settings import settings

async def main():
    db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT client_id FROM users WHERE username = '1emreyns'"))
        row = res.fetchone()
        if row:
            print(f"1emreyns ClientId: {row[0]}")
        else:
            print("Not found")

if __name__ == "__main__":
    asyncio.run(main())
