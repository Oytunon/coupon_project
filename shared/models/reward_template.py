"""
Ödül yapılandırmaları için kaydedilen şablonlar.
Admin panelinden ödül listelerini kaydet/yükle işlemleri için kullanılır.
"""
from sqlalchemy import Column, Integer, String, JSON, DateTime, func
from shared.database import Base


class RewardTemplate(Base):
    __tablename__ = "reward_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    reward_data = Column(JSON, nullable=False) # List of reward objects
    created_at = Column(DateTime, server_default=func.now())
