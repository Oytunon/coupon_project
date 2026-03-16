"""
Lig uyumlu kaybeden kuponların listesi.
Worker Lost + eligible işaretlendiğinde bu tabloya yazılır.
Yatırım metriği (katılımcıların kaybeden kupon bahis toplamı) buradan hesaplanır.
"""
from sqlalchemy import Column, Integer, BigInteger, Float, DateTime, ForeignKey, UniqueConstraint, func
from shared.database import Base


class EventLostCoupon(Base):
    __tablename__ = "event_lost_coupons"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    coupon_id = Column(Integer, ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(BigInteger, nullable=False, index=True)
    stake = Column(Float, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("event_id", "coupon_id", name="uq_event_lost_coupon"),
    )
