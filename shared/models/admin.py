from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from shared.database import Base

class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    email = Column(String, nullable=True)
    verification_code = Column(String, nullable=True)
    verification_code_expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="admin")  # admin, superadmin
    created_at = Column(DateTime, server_default=func.now())
