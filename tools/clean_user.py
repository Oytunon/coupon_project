from common.models.participant import Participant
from common.database import Base, engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from common.settings import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def clean_user(username):
    # Base.metadata.create_all(bind=engine) # Ensure tables exist
    user = db.query(Participant).filter(Participant.username == username).first()
    if user:
        print(f"Deleting user: {username} (ID: {user.client_id})")
        db.delete(user)
        db.commit()
    else:
        print(f"User {username} not found.")
    db.close()

if __name__ == "__main__":
    clean_user("cengizcagin")
