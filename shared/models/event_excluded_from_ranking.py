"""
Lig uyumlu ancak oran şartından elenen kuponlar (Won/Lost).
Sıralamaya dahil edilmez, sadece istatistiklerde "Sıralamaya Girmeyen Toplam Mebla" için kullanılır.
Coupon/CouponEventResult'a yazılmaz, client frontend'de görünmez.
"""
from sqlalchemy import Column, Integer, BigInteger, Float, String, DateTime, ForeignKey, UniqueConstraint, func
from shared.database import Base


class EventExcludedFromRanking(Base):
    __tablename__ = "event_excluded_from_ranking"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(BigInteger, nullable=False, index=True)
    bet_id = Column(String(64), nullable=False, index=True)
    stake = Column(Float, nullable=False)
    state = Column(String(16), nullable=False)  # 'won' or 'lost'
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("event_id", "bet_id", name="uq_event_excluded_bet"),
    )
