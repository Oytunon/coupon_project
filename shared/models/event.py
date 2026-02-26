from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from shared.database import Base


class Event(Base):
    """
    Event/Kampanya modeli.
    Her event'in kendi kuralları, puan çarpanları ve tarih aralığı vardır.
    """
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(50), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    image_url = Column(String(512), nullable=True)

    # Status Management
    status = Column(String(16), nullable=False, default="draft", index=True)
    # Olası değerler: 'draft', 'active', 'paused', 'ended', 'archived'

    # Tarih Aralığı
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    display_until = Column(DateTime, nullable=True)  # Client frontend'de ne zamana kadar görünecek

    # Puan Çarpanları
    won_point_multiplier = Column(Float, nullable=False, default=1.0)
    loss_point_multiplier = Column(Float, nullable=False, default=0.0)
    # draw_point_multiplier removed

    # Event-Specific Kurallar (JSONB)
    # Her event'in kendi kupon doğrulama kuralları
    # Worker bu kurallara göre kuponları filtreler
    rules = Column(JSONB, nullable=False, default={
        "min_stake": 100,
        "min_odd": 1.5,
        "min_combination": 2,
        "max_combination": None,
        "allowed_league_ids": [],  # Boş array = tüm ligler
        "max_coupons_per_user": None,  # None = limit yok
        "scoring_formula": "stake_times_odds",  # 'simple', 'stake_times_odds', 'combo_bonus'
        "combo_bonus_enabled": False,
        "combo_bonus_multiplier": 0.1,
        "min_deposit": 1000  # Default 1000 TL
    })

    # Admin Info
    created_by = Column(Integer, ForeignKey("admin_users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Event(id={self.id}, name='{self.name}', status='{self.status}')>"

    @property
    def is_active(self) -> bool:
        """Event şu anda aktif mi?"""
        return self.status == "active"

    @property
    def is_ended(self) -> bool:
        """Event sona erdi mi?"""
        return self.status in ["ended", "archived"]
