from sqlalchemy import Column, Integer, BigInteger, String, DateTime, func
from common.database import Base


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String, nullable=True, index=True)  # User login/username
    joined_at = Column(DateTime, server_default=func.now())
