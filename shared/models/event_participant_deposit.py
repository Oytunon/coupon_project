"""
Katılımcının turnuvaya katıldıktan sonraki toplam yatırım miktarını tutar.
GetDepositsWithdrawalsWithPaging API'den çekilip worker tarafından güncellenir.
"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, func, UniqueConstraint, Float, String
from shared.database import Base


class EventParticipantDeposit(Base):
    __tablename__ = "event_participant_deposits"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id = Column(Integer, ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True)

    total_deposit_amount = Column(Float, default=0.0, nullable=False)
    currency_id = Column(String(8), default="TRY", nullable=True)
    last_synced_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("event_id", "participant_id", name="uq_event_participant_deposit"),
    )

    def __repr__(self):
        return f"<EventParticipantDeposit(event={self.event_id}, participant={self.participant_id}, amount={self.total_deposit_amount})>"
