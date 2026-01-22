from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from shared.database import Base


class CouponEventResult(Base):
    """
    Kupon-Event ilişkisi ve sonuç tablosu.
    Bir kuponun belirli bir event'teki durumunu, uygunluğunu ve kazandığı puanı saklar.
    """
    __tablename__ = "coupon_event_results"

    id = Column(Integer, primary_key=True, index=True)

    # İlişkiler
    coupon_id = Column(Integer, ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)

    # Eligibility (Uygunluk)
    is_eligible = Column(Boolean, nullable=False, default=True)
    # Kupon bu event'in kurallarına uygun mu?

    eligibility_reason = Column(Text, nullable=True)
    # Neden uygun/uygun değil? (örn: "Stake too low: 50 < 100")

    # Kupon Durumu (Event-Specific)
    coupon_state = Column(String(16), nullable=True)
    # 'pending', 'won', 'lost', 'void', 'cashout'

    # Puanlama
    points_earned = Column(Float, nullable=False, default=0.0)
    # Bu event için kazanılan puan

    points_calculation = Column(JSONB, nullable=True)
    # Puan hesaplama detayı
    # Örnek: {
    #   "base_points": 100,
    #   "multiplier": 1.5,
    #   "formula": "stake * odds * multiplier",
    #   "final_points": 150
    # }

    # Timestamps
    evaluated_at = Column(DateTime, nullable=True)
    # Kuponun bu event için son değerlendirilme zamanı

    last_checked_at = Column(DateTime, nullable=True)
    # Worker'ın bu kaydı son kontrol ettiği zaman

    created_at = Column(DateTime, server_default=func.now())

    # Constraints
    __table_args__ = (
        UniqueConstraint('coupon_id', 'event_id', name='uq_coupon_event'),
    )

    def __repr__(self):
        return (
            f"<CouponEventResult(id={self.id}, coupon_id={self.coupon_id}, "
            f"event_id={self.event_id}, eligible={self.is_eligible}, "
            f"state='{self.coupon_state}', points={self.points_earned})>"
        )
