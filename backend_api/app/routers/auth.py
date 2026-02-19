from datetime import timedelta, datetime
from typing import Annotated
import secrets
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from shared.core.limiter import limiter
from pydantic import BaseModel, EmailStr

from backend_api.app.deps import get_db
from shared.models.admin import AdminUser
from shared.models.magic_token import MagicToken
from shared.settings import settings
from backend_api.app.security import (
    create_access_token, 
    verify_password
)
from backend_api.app.schemas import Token
from shared.services.email import send_magic_link_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Centralized limiter is imported from shared.core.limiter




# Schemas
class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkWithCredentials(BaseModel):
    username: str
    password: str


class MagicLinkVerify(BaseModel):
    token: str


# Magic Link Authentication (Primary Method)

@router.post("/request-magic-link")
async def request_magic_link_with_credentials(
    credentials: MagicLinkWithCredentials,
    db: Session = Depends(get_db)
):
    """Username ve password ile magic link talep et (2FA style)"""
    
    # Username ve password kontrolü
    user = db.query(AdminUser).filter(AdminUser.username == credentials.username).first()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hatalı kullanıcı adı veya şifre"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı hesabı aktif değil"
        )
    
    # Random token oluştur (32 byte = 256 bit güvenlik)
    token = secrets.token_urlsafe(32)
    
    # MagicToken kaydı oluştur (24 saat geçerli)
    magic_token = MagicToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=24),
        is_used=False
    )
    db.add(magic_token)
    db.commit()
    
    # Magic link URL oluştur
    magic_link = f"{settings.MAGIC_LINK_URL}?token={token}"
    
    # Kullanıcının email adresine gönder
    try:
        await send_magic_link_email(user.email, magic_link)
        logger.info(f"Magic link sent to {user.email} for user {user.username}")
    except Exception as e:
        logger.error(f"Failed to send magic link email: {e}", exc_info=True)
    
    return {"message": "Email adresinize giriş linki gönderildi.", "email": user.email}


@router.post("/magic-link")
@limiter.limit("5/minute")
async def request_magic_link(
    request: Request,
    magic_request: MagicLinkRequest,
    db: Session = Depends(get_db)
):
    """Email ile magic link talep et"""
    
    # Email'e göre kullanıcı bul
    user = db.query(AdminUser).filter(AdminUser.email == magic_request.email).first()
    
    if not user:
        # Security: Email bulunamadı bile olsa başarılı gibi görün
        # (Email enumeration attack önleme)
        return {"message": "Eğer bu email kayıtlıysa, giriş linki gönderildi."}
    
    if not user.is_active:
        # Pasif kullanıcı için de aynı mesaj
        return {"message": "Eğer bu email kayıtlıysa, giriş linki gönderildi."}
    
    # Random token oluştur (32 byte = 256 bit güvenlik)
    token = secrets.token_urlsafe(32)
    
    # MagicToken kaydı oluştur (24 saat geçerli)
    magic_token = MagicToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=24),
        is_used=False
    )
    db.add(magic_token)
    db.commit()
    
    # Magic link URL oluştur
    magic_link = f"{settings.MAGIC_LINK_URL}?token={token}"
    
    # Email gönder
    try:
        await send_magic_link_email(user.email, magic_link)
        logger.info(f"Magic link sent to {user.email}")
    except Exception as e:
        # Email gönderimi başarısız olsa bile kullanıcıya hata gösterme
        # (Security: Email provider bilgisi sızdırma)
        logger.error(f"Failed to send magic link email: {e}", exc_info=True)
    
    return {"message": "Giriş linki e-posta adresinize gönderildi."}


@router.post("/verify-magic-link", response_model=Token)
async def verify_magic_link(
    verify_request: MagicLinkVerify,
    db: Session = Depends(get_db)
):
    """Magic link token'ı doğrula ve JWT döndür"""
    
    # Token'ı bul
    logger.info(f"Verifying magic link token: {verify_request.token[:10]}...")
    magic_token = db.query(MagicToken).filter(
        MagicToken.token == verify_request.token
    ).first()
    
    if not magic_token:
        logger.warning(f"Magic token not found in database: {verify_request.token[:10]}...")
        # Debug: Check if there are ANY tokens
        total_tokens = db.query(MagicToken).count()
        logger.info(f"Total magic tokens in DB: {total_tokens}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya süresi dolmuş link"
        )
    
    # Kullanılmış mı kontrol et
    if magic_token.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu link daha önce kullanılmış"
        )
    
    # Süresi dolmuş mu kontrol et
    now = datetime.utcnow()
    logger.info(f"Token expires at: {magic_token.expires_at}, Current time: {now}")
    if magic_token.expires_at < now:
        logger.warning(f"Token expired. Exp: {magic_token.expires_at}, Now: {now}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Linkin süresi dolmuş"
        )
    
    # Kullanıcıyı al
    user = db.query(AdminUser).filter(AdminUser.id == magic_token.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kullanıcı bulunamadı veya aktif değil"
        )
    
    # Token'ı kullanılmış olarak işaretle
    magic_token.is_used = True
    db.commit()
    
    # JWT oluştur ve döndür
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer")


# Legacy: Direct Password Login (DISABLED)
@router.post("/token", response_model=Token)
@limiter.limit("5/minute")
async def login_for_access_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    """
    Direct JWT authentication (Updated for Super Admin support)
    """
    # 1. Kullanıcıyı bul
    user = db.query(AdminUser).filter(AdminUser.username == form_data.username).first()
    
    # 2. Şifre kontrolü
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hatalı kullanıcı adı veya şifre",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # 3. Aktiflik kontrolü
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kullanıcı aktif değil"
        )

    # 4. Token oluştur
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer")
