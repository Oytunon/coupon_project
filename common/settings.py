import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Uygulama yapılandırma ayarları."""

    model_config = SettingsConfigDict(
        env_file=os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            ".env"
        ),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # Veritabanı
    DATABASE_URL: str = "postgresql://coupon_user:coupon_pass@localhost:5432/coupon_db"

    # Pool ayarları
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600
    DB_ECHO: bool = False

    # Retry
    DB_RETRY_ATTEMPTS: int = 3
    DB_RETRY_DELAY: int = 1

    # API
    API_TOKEN: Optional[str] = None

    # Betconstruct
    BAPI_TOKEN: Optional[str] = None
    BAPI_CLIENT_INFO_URL: str = "https://backofficewebadmin.betconstruct.com/api/en/Client/GetClients"
    BAPI_DEPOSIT_URL: str = "https://backofficewebadmin.betconstruct.com/api/en/Client/GetClientTransactionsV1"
    BAPI_BET_HISTORY_URL: str = "https://backofficewebadmin.betconstruct.com/api/en/Report/GetBetHistory"
    BAPI_BET_SELECTIONS_URL: str = "https://backofficewebadmin.betconstruct.com/api/en/Sport/GetBetSelections"

    # Kurallar
    MIN_STAKE: float = 100.0
    MIN_COMBINATION: int = 2
    MIN_ODD: float = 1.50

    # Sunucu
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    FRONTEND_URL: Optional[str] = None


# Ayar nesnesi oluşturulur ve uygulama genelinde kullanılır
settings = Settings()
