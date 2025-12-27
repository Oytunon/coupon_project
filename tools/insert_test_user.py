import os
import sys

# Add root directory to sys.path to allow imports from common
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from common.database import SessionLocal, engine, Base
from common.models.participant import Participant

def insert_test_user():
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        username = "cengizcagin"
        client_id = 1043017727
        
        # Check if exists
        exists = db.query(Participant).filter_by(client_id=client_id).first()
        if exists:
            print(f"User {username} (ID: {client_id}) already exists in database.")
            return

        user = Participant(username=username, client_id=client_id)
        db.add(user)
        db.commit()
        print(f"✅ Success: User {username} (ID: {client_id}) inserted into participants table.")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    insert_test_user()
