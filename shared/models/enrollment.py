from sqlalchemy import Column, Integer, ForeignKey, DateTime, func, UniqueConstraint, Float
from shared.database import Base

class EventParticipant(Base):
    """
    Kullanıcıların hangi event'lere katıldığını tutan tablo (Opt-in).
    """
    __tablename__ = "event_participants"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id = Column(Integer, ForeignKey("participants.id"), nullable=False, index=True)
    
    joined_at = Column(DateTime, server_default=func.now())
    total_points = Column(Float, default=0.0)
    
    # Bir kullanıcı bir event'e sadece bir kez katılabilir
    __table_args__ = (
        UniqueConstraint('event_id', 'participant_id', name='uq_event_participant'),
    )

    def __repr__(self):
        return f"<EventParticipant(event={self.event_id}, participant={self.participant_id})>"
