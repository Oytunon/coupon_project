from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    Float,
    String,
    Boolean,
    DateTime,
    func
)
from common.database import Base


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(BigInteger, index=True, nullable=False)
    bet_id = Column(String(64), unique=True, index=True, nullable=False)

    created_at = Column(DateTime, nullable=False)

    stake = Column(Float, nullable=False)
    odds = Column(Float, nullable=False)
    combination_count = Column(Integer, nullable=True)
    is_live = Column(Boolean, default=False)

    state = Column(String(16), default="open")
    winning = Column(Float, default=0)

    calculation = Column(Boolean, default=False)
    checked_at = Column(DateTime, nullable=True)

    inserted_at = Column(DateTime, server_default=func.now())
