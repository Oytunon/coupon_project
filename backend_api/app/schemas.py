from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, Any

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class AdminUserBase(BaseModel):
    username: str

class AdminUserCreate(AdminUserBase):
    password: str

class AdminUserResponse(AdminUserBase):
    id: int
    is_active: bool
    role: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ConfigUpdate(BaseModel):
    key: str
    value: Any

class ParticipantResponse(BaseModel):
    id: int
    client_id: int
    username: Optional[str] = None
    joined_at: Optional[datetime] = None
    coupon_count: int = 0
    points: int = 0

class CouponResponse(BaseModel):
    id: int
    client_id: int
    bet_id: str
    created_at: datetime
    stake: float
    odds: float
    state: str
    winning: float
    
    model_config = ConfigDict(from_attributes=True)
