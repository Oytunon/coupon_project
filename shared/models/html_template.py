"""
Kullanıcı Kuralları (HTML) için kaydedilen şablonlar.
Admin panelinden kaydet/yükle işlemleri için kullanılır.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, func
from shared.database import Base


class HtmlTemplate(Base):
    __tablename__ = "html_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    html_content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
