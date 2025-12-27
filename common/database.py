from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool
from sqlalchemy.exc import DisconnectionError
from common.settings import settings
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
        kwargs["pool_pre_ping"] = True  # Connection health check
    
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
    for attempt in range(settings.DB_RETRY_ATTEMPTS):
        try:
            db = SessionLocal()
            # Connection test
            db.execute(text("SELECT 1"))
            return db
        except (DisconnectionError, Exception) as e:
            logger.warning(f"Database connection attempt {attempt + 1} failed: {e}")
            if attempt < settings.DB_RETRY_ATTEMPTS - 1:
                time.sleep(settings.DB_RETRY_DELAY)
            else:
                raise
    return None


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
