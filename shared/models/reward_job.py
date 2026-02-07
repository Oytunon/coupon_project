from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from shared.database import Base

class RewardJob(Base):
    __tablename__ = "reward_jobs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True)
    event_name_snapshot = Column(String(255), nullable=True)
    status = Column(String, default="pending", index=True) # pending, processing, completed, failed
    
    # Store detailed results: { "user_id": { "status": "success", "amount": 100, "tx_id": "..." } }
    results = Column(JSONB, default={}) 
    
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime, nullable=True)
