from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool
from sqlalchemy.exc import DisconnectionError, OperationalError
from fastapi import HTTPException
from shared.settings import settings
from shared.exceptions import BAPIRateLimitError
import time
import logging

logger = logging.getLogger(__name__)

# Database URL'den database türünü belirle
def get_database_type(db_url: str) -> str:
    """Database türünü URL'den belirle"""
    if db_url.startswith("postgresql") or db_url.startswith("postgres"):
        return "postgresql"
    elif db_url.startswith("mysql"):
        return "mysql"
    elif db_url.startswith("sqlite"):
        return "sqlite"
    else:
        return "unknown"

# Database türüne göre engine parametreleri
def get_engine_kwargs(db_url: str) -> dict:
    """Database türüne göre engine parametrelerini döndür"""
    db_type = get_database_type(db_url)
    kwargs = {
        "echo": settings.DB_ECHO,
        "future": True,
    }
    
    # SQLite için pool kullanma
    if db_type == "sqlite":
        kwargs["poolclass"] = None
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # PostgreSQL/MySQL için connection pooling
        kwargs["poolclass"] = QueuePool
        kwargs["pool_size"] = settings.DB_POOL_SIZE
        kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
        kwargs["pool_timeout"] = settings.DB_POOL_TIMEOUT
        kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE
        kwargs["pool_pre_ping"] = True  # Bağlantı sağlık kontrolü
    
    return kwargs

# Engine oluştur
engine = create_engine(
    settings.DATABASE_URL,
    **get_engine_kwargs(settings.DATABASE_URL)
)

# Connection retry mekanizması
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """SQLite için pragma ayarları"""
    if get_database_type(settings.DATABASE_URL) == "sqlite":
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# Session factory
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False
)

Base = declarative_base()


def get_db_session():
    """Database session oluştur (retry ile)"""
    db = None
    try:
        db = SessionLocal()
        # Bağlantı testi (Opsiyonel, zaten pool ping yapıyor)
        # db.execute(text("SELECT 1")) 
        yield db
    except HTTPException:
        if db:
            db.rollback()
        raise
    except BAPIRateLimitError:
        if db:
            db.rollback()
        _h = settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "db"
        logger.warning(f"BAPI rate limit (429) | host={_h}")
        raise
    except Exception as e:
        err_str = str(e)
        if "429" in err_str or "rate" in err_str.lower() or "per minute" in err_str.lower():
            if db:
                db.rollback()
            raise
        _url = settings.DATABASE_URL
        if "@" in _url:
            _url = _url.split("@")[-1]
        logger.error(f"Database session error: {e} | host={_url}")
        if db:
            db.rollback()
        raise
    finally:
        if db:
            try:
                db.close()
            except OperationalError as e:
                # Bağlantı sunucu tarafından kapatılmış olabilir - sessizce geç
                logger.debug(f"Session close failed (connection already closed): {e}")


def check_database_health() -> bool:
    """Database bağlantisini kontrol et"""
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False
