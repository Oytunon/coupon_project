from fastapi import Header, HTTPException, Security
from fastapi.security import APIKeyHeader
from typing import Optional
from common.database import get_db_session
from common.settings import settings

# API Key Header - Frontend'den gelen istekler için
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def get_db():
    """FastAPI dependency - Database session"""
    db = get_db_session()
    try:
        yield db
    finally:
        db.close()


def verify_api_token(api_key: Optional[str] = Security(api_key_header)) -> bool:
    """API token doğrulama. X-API-Key header'ını kontrol eder."""
    
    # API_TOKEN ayarlanmamışsa geçişe izin ver (dev modu)
    if not settings.API_TOKEN:
        return True
    
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="API token required. Please provide X-API-Key header."
        )
    
    if api_key != settings.API_TOKEN:
        raise HTTPException(
            status_code=403,
            detail="Invalid API token."
        )
    
    return True
