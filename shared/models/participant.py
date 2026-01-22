from sqlalchemy import Column, Integer, BigInteger, String, Float, Boolean, DateTime, func
from shared.database import Base


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String, nullable=True, index=True)  # User login/username
    
    # Event-based scoring
    total_points = Column(Float, default=0.0)  # Cache: tüm eventlerdeki toplam puan
    is_active = Column(Boolean, default=True)  # Aktif katılımcı mı?
    
    joined_at = Column(DateTime, server_default=func.now())
