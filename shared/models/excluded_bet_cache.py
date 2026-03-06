from sqlalchemy import Column, Integer, BigInteger, String, DateTime, func
from shared.database import Base


class ExcludedBetCache(Base):
    """
    Min_odd veya allowed_leagues kurallarını geçemeyen kuponların cache tablosu.
    Puanlama sistemiyle SIFIR etkileşimi var — sadece gereksiz API çağrılarını engellemek için.
    Kayıtlar 24 saat sonra otomatik temizlenir.
    """
    __tablename__ = "excluded_bet_cache"

    id = Column(Integer, primary_key=True, index=True)
    bet_id = Column(String(64), unique=True, index=True, nullable=False)
    client_id = Column(BigInteger, index=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
