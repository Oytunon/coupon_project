from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool, NullPool
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

# Supabase pooler (6543) kullanılıyor mu?
def is_supabase_pooler(db_url: str) -> bool:
    return "pooler.supabase.com" in db_url and ":6543" in db_url


# Supabase Session mode (5432) - MaxClients sınırlı, pool küçük tutulmalı
def is_supabase_session_mode(db_url: str) -> bool:
    return "pooler.supabase.com" in db_url and ":6543" not in db_url


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
        # Supabase pooler (6543): NullPool - Transaction mode, Supabase kendi pool'unu kullanır.
        # API için 6543 ÖNERİLİR - paralel istekler sorunsuz çalışır.
        if is_supabase_pooler(db_url):
            kwargs["poolclass"] = NullPool
            kwargs["connect_args"] = {"connect_timeout": 10}
            logger.info("Supabase Transaction mode (6543): NullPool - önerilen üretim ayarı")
        else:
            # Normal PostgreSQL/MySQL: QueuePool
            # Supabase Session mode (5432): pool_size 2+1 çok düşük - paralel istekler timeout olur.
            # Frontend aynı anda 4-6 istek atıyor (events, rewards, coupons, enrollments) -> en az 5-6 bağlantı gerekli.
            pool_size = settings.DB_POOL_SIZE
            max_overflow = settings.DB_MAX_OVERFLOW
            if is_supabase_session_mode(db_url):
                pool_size = max(5, settings.DB_POOL_SIZE)  # En az 5 (frontend paralel istekler için)
                max_overflow = max(5, settings.DB_MAX_OVERFLOW)
                logger.warning(
                    f"Supabase Session mode (5432): pool_size={pool_size}, max_overflow={max_overflow}. "
                    "Paralel timeout sorunları için DATABASE_URL portunu 6543 yapın (Transaction mode)."
                )
            kwargs["poolclass"] = QueuePool
            kwargs["pool_size"] = pool_size
            kwargs["max_overflow"] = max_overflow
            kwargs["pool_timeout"] = settings.DB_POOL_TIMEOUT
            kwargs["pool_pre_ping"] = True
            kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE
    
    return kwargs

# Engine 1: Ana (API, Worker) - DATABASE_URL, genelde 6543 Pooler
engine = create_engine(
    settings.DATABASE_URL,
    **get_engine_kwargs(settings.DATABASE_URL)
)

# Engine 2: Direct (Migration, uzun scriptler) - DATABASE_URL_DIRECT, genelde 5432
# Ayarlanmamışsa ana engine kullanılır
engine_direct = None
if settings.DATABASE_URL_DIRECT and settings.DATABASE_URL_DIRECT != settings.DATABASE_URL:
    engine_direct = create_engine(
        settings.DATABASE_URL_DIRECT,
        **get_engine_kwargs(settings.DATABASE_URL_DIRECT)
    )
    logger.info("Dual-port: engine_direct (5432) migration/script için ayrıldı")

# Connection retry mekanizması
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """SQLite için pragma ayarları"""
    if get_database_type(settings.DATABASE_URL) == "sqlite":
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# Session factory - Ana (API, Worker)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False
)

# Session factory - Direct (Migration, recalculate vb.)
SessionLocalDirect = sessionmaker(
    bind=engine_direct or engine,
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


def get_db_session_direct():
    """Direct connection (5432) - Migration, recalculate gibi uzun işlemler için."""
    db = None
    try:
        db = SessionLocalDirect()
        yield db
    finally:
        if db:
            try:
                db.close()
            except OperationalError:
                pass


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
