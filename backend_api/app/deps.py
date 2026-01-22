from fastapi import Header, HTTPException, Security, Depends
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from typing import Optional
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from shared.database import get_db_session
from shared.settings import settings

# API Key Header - For static key
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
# OAuth2 for Bearer token (JWT)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token", auto_error=False)


def get_db():
    """FastAPI dependency - Database session"""
    yield from get_db_session()


async def verify_api_token(
    api_key: Optional[str] = Security(api_key_header),
    token: Optional[str] = Security(oauth2_scheme)
) -> bool:
    """
    API token doğrulama. 
    1. X-API-Key header'ında Static Token kontrol eder.
    2. Eğer yoksa/eşleşmezse, X-API-Key veya Bearer token içindeki JWT'yi doğrular.
    """
    
    # 1. Static Token Check
    if settings.API_TOKEN and api_key == settings.API_TOKEN:
        return True
        
    # 2. JWT Check
    # Frontend might send JWT in X-API-Key OR Authorization Bearer
    jwt_token = token or api_key
    
    if not jwt_token:
        # Dev mode check only if no authentication provided at all
        if not settings.API_TOKEN: 
            return True
            
        raise HTTPException(
            status_code=401,
            detail="Authentication required (API Key or JWT)"
        )

    try:
        payload = jwt.decode(
            jwt_token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
             raise HTTPException(status_code=403, detail="Invalid token payload")
        return True
    except JWTError:
        raise HTTPException(
            status_code=403,
            detail="Invalid authentication credentials"
        )
