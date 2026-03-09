from sqlalchemy import Column, Integer, BigInteger, String, DateTime, func, UniqueConstraint
from shared.database import Base


class ExcludedBetCache(Base):
    """
    Min_odd veya allowed_leagues kurallarını geçemeyen kuponların cache tablosu.
    Puanlama sistemiyle SIFIR etkileşimi var — sadece gereksiz API çağrılarını engellemek için.
    Kayıtlar 72 saat sonra otomatik temizlenir.
    """
    __tablename__ = "excluded_bet_cache"

    id = Column(Integer, primary_key=True, index=True)
    bet_id = Column(String(64), index=True, nullable=False)
    client_id = Column(BigInteger, index=True, nullable=False)
    event_id = Column(Integer, index=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint('bet_id', 'event_id', name='uq_excluded_bet_event'),
    )
