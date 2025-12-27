"""
Migration: Add client_id column to participants table
Run this script to update the database schema.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from common.database import engine

def migrate():
    """Add client_id column to participants table"""
    with engine.connect() as conn:
        # Check if client_id column already exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'participants' AND column_name = 'client_id'
        """))
        
        if result.fetchone():
            print("✅ client_id kolonu zaten mevcut")
            return
        
        # Start transaction
        trans = conn.begin()
        
        try:
            # Add client_id column (nullable first, we'll update it later)
            print("📝 client_id kolonu ekleniyor...")
            conn.execute(text("""
                ALTER TABLE participants 
                ADD COLUMN client_id BIGINT
            """))
            
            # Make username nullable (if it's not already)
            print("📝 username kolonu nullable yapılıyor...")
            conn.execute(text("""
                ALTER TABLE participants 
                ALTER COLUMN username DROP NOT NULL
            """))
            
            # Add unique constraint on client_id (after data migration)
            print("📝 client_id için unique index ekleniyor...")
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS ix_participants_client_id 
                ON participants (client_id)
            """))
            
            # Add index on username if not exists
            print("📝 username için index kontrol ediliyor...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_participants_username 
                ON participants (username)
            """))
            
            trans.commit()
            print("✅ Migration başarılı!")
            print("⚠️  NOT: Mevcut kayıtlar için client_id değerleri NULL olacak.")
            print("    Bu kayıtları manuel olarak güncellemeniz gerekebilir.")
            
        except Exception as e:
            trans.rollback()
            print(f"❌ Migration hatası: {e}")
            raise

if __name__ == "__main__":
    migrate()

