from sqlalchemy import Column, Integer, String, DateTime, func, Text
from shared.database import Base

class WorkerLog(Base):
    __tablename__ = "worker_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, nullable=True) # None means all events (cron)
    job_type = Column(String, default="coupon") # "coupon" veya "stats"
    status = Column(String, default="pending") # pending, running, completed, failed
    processed_count = Column(Integer, default=0)
    saved_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0) # Total users to process
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
