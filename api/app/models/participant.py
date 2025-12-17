from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.database import Base

class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
