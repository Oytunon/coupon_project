from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    Float,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    func
)
from sqlalchemy.dialects.postgresql import JSONB
from shared.database import Base


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(BigInteger, index=True, nullable=False)
    bet_id = Column(String(64), unique=True, index=True, nullable=False)
    
    # Store full bet details (matches, scores, etc.)
    bet_data = Column(JSONB, nullable=True)
    
    # Event Association - Multi-Event Support
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=True, index=True)

    created_at = Column(DateTime, nullable=False)

    stake = Column(Float, nullable=False)
    odds = Column(Float, nullable=False)
    combination_count = Column(Integer, nullable=True)
    is_live = Column(Boolean, default=False)

    # Eski state kolonu (backward compatibility için kalsın)
    state = Column(String(16), default="open")
    
    # Yeni: Event-agnostic overall state
    overall_state = Column(String(16), default="pending")
    # 'pending', 'settled', 'void'
    
    winning = Column(Float, default=0)

    calculation = Column(Float, default=0.0)
    checked_at = Column(DateTime, nullable=True)
    
    # Worker processing tracking
    is_processed = Column(Boolean, default=False)
    processed_at = Column(DateTime, nullable=True)
    
    # B-API sync tracking
    last_synced_at = Column(DateTime, nullable=True)

    inserted_at = Column(DateTime, server_default=func.now())
