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
    # DATABASE_URL: Ana bağlantı - API, Worker için
    # Supabase: Port 6543 (Transaction mode) KULLANIN - 5432 ile "QueuePool limit" hatası olur.
    # Örnek: postgresql://postgres.xxx:pass@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
    DATABASE_URL: str = "postgresql://coupon_user:coupon_pass@localhost:5432/coupon_db"
    # DATABASE_URL_DIRECT: Opsiyonel - Migration, uzun scriptler için (5432 Direct)
    # İki port: 6543=Pooler (yüksek eşzamanlılık), 5432=Direct (migration/script)
    DATABASE_URL_DIRECT: Optional[str] = None

    # Pool ayarları (SQLAlchemy varsayılanları)
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 300  # 5 dk - managed DB'ler genelde daha kısa idle timeout kullanır
    DB_ECHO: bool = False

    # Retry
    DB_RETRY_ATTEMPTS: int = 3
    DB_RETRY_DELAY: int = 1

    # API
    API_TOKEN: Optional[str] = None
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Betconstruct
    BAPI_TOKEN: Optional[str] = None
    BAPI_CLIENT_INFO_URL: str = "https://backofficewebadmin.betconstruct.com/api/en/Client/GetClients"
    BAPI_DEPOSIT_URL: str = "https://backofficewebadmin.betconstruct.com/api/en/Client/GetClientTransactionsV1"
    BAPI_BET_HISTORY_URL: str = "https://backofficewebadmin.betconstruct.com/api/en/Report/GetBetHistory"
    BAPI_BET_REPORT_URL: str = "https://backofficewebadmin.betconstruct.com/api/en/Report/GetBetReport"
    BAPI_BET_SELECTIONS_URL: str = "https://backofficewebadmin.betconstruct.com/api/en/Sport/GetBetSelections"
    BAPI_DEPOSIT_REPORT_URL: str = "https://backofficewebadmin.betconstruct.com/api/en/Financial/GetDepositsWithdrawalsWithPaging"

    # Mailgun (Email)
    MAILGUN_API_KEY: Optional[str] = None
    MAILGUN_DOMAIN: Optional[str] = None
    MAILGUN_FROM_EMAIL: str = "noreply@extrabet.com"
    MAILGUN_FROM_NAME: str = "Extrabet Admin"
    MAILGUN_BASE_URL: str = "https://api.eu.mailgun.net"  # EU endpoint (değiştirilebilir)

    # Frontend URL for Magic Link (User preferred 3000)
    MAGIC_LINK_URL: str = "https://coupon-project-three.vercel.app/verify-magic-link"

    # Sunucu
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    FRONTEND_URL: Optional[str] = None

    # Security (REQUIRED for main.py)
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5175,http://localhost:3000,https://coupon-project-three.vercel.app,https://coupon-project-three.vercel.app/"

    def validate_required_settings(self):
        """Production'da zorunlu ayarları kontrol et"""
        errors = []
        
        # SECRET_KEY kontrolü
        if self.SECRET_KEY == "your-super-secret-key-change-in-production":
            errors.append("SECRET_KEY production'da değiştirilmeli! Güçlü bir anahtar kullanın.")
        
        # API_TOKEN kontrolü
        if not self.API_TOKEN:
            errors.append("API_TOKEN zorunludur! .env dosyasında ayarlayın.")
        
        # BAPI_TOKEN kontrolü
        if not self.BAPI_TOKEN:
            errors.append("BAPI_TOKEN zorunludur! Betconstruct API anahtarını .env dosyasında ayarlayın.")
        
        if errors:
            error_msg = "\n".join(f"  - {err}" for err in errors)
            raise ValueError(f"Eksik veya hatalı environment variables:\n{error_msg}")


# Ayar nesnesi oluşturulur ve uygulama genelinde kullanılır
settings = Settings()
