import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from shared.core.limiter import limiter

from shared.database import Base, engine
from shared.settings import settings
from shared.models import *  # Import all models to ensure they are registered
from shared.logging_config import setup_logging
from shared.exceptions import CouponAppException

from backend_api.app.routers.participation import router as participation_router
from backend_api.app.routers.admin import router as admin_router
from backend_api.app.routers.auth import router as auth_router
from backend_api.app.routers.events import router as events_router
from backend_api.app.routers.user_stats import router as user_stats_router
from backend_api.app.routers.client import router as client_router
from backend_api.app.middleware import SecurityHeadersMiddleware
from fastapi.staticfiles import StaticFiles
import os

# Setup Logging
logger = setup_logging()

# Validate critical environment variables on startup
# TEMPORARILY DISABLED for demo - re-enable in production
# try:
#     settings.validate_required_settings()
#     logger.info("✅ Environment validation passed")
# except ValueError as e:
#     logger.error(f"❌ Environment validation failed:\n{e}")
#     raise
logger.info("⚠️ Environment validation disabled (demo mode)")



# Check if database migrations are up to date
# IMPORTANT: Run migrations manually before starting the app
# Use: alembic upgrade head
def check_migration_status():
    """Check if database is up to date with migrations"""
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        from alembic.runtime.migration import MigrationContext
        
        # Get current migration version from database
        with engine.connect() as connection:
            context = MigrationContext.configure(connection)
            current_rev = context.get_current_revision()
        
        # Get latest migration version from files
        alembic_cfg = Config("alembic.ini")
        script = ScriptDirectory.from_config(alembic_cfg)
        head_rev = script.get_current_head()
        
        if current_rev is None:
            logger.warning("⚠ Database has no migration version. Please run: alembic upgrade head")
            return False
        elif current_rev != head_rev:
            logger.warning(f"⚠ Database migration out of date! Current: {current_rev}, Latest: {head_rev}")
            logger.warning("⚠ Please run: alembic upgrade head")
            return False
        else:
            logger.info(f"✅ Database migrations up to date (revision: {current_rev})")
            return True
    except Exception as e:
        logger.warning(f"⚠ Could not check migration status: {e}")
        logger.warning("⚠ Please ensure database exists and run: alembic upgrade head")
        return False

# Check migration status on startup
check_migration_status()


# Initialize FastAPI app
app = FastAPI(
    title="Kupon Turnuvası API",
    description="Coupon Tournament Management System with Mailgun Integration",
    version="2.0.0"
)

# Rate limiting setup
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Global Exception Handler
@app.exception_handler(CouponAppException)
async def coupon_app_exception_handler(request: Request, exc: CouponAppException):
    return JSONResponse(
        status_code=400,
        content={"message": exc.message, "code": exc.code},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"422 Validation Error at {request.url}: {exc.errors()}")
    logger.error(f"Request body: {await request.body()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(await request.body())},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from starlette.exceptions import HTTPException as StarletteHTTPException
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
        
    logger.error(f"Global error at {request.url}: {exc}")
    
    error_str = str(exc)
    
    # Check for BAPI Rate Limit (403)
    if "403" in error_str and "request limit" in error_str:
        return JSONResponse(
            status_code=429, # Too Many Requests
            content={"message": "Sunucu Yoğunluğu", "detail": "Lütfen daha sonra tekrar deneyiniz."},
        )

    # Generic Error - Hide details from Production Frontend
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": "Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyiniz."},
    )

# CORS configuration - Hardened for security
allowed_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],  # Only required methods
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With"
    ],  # Only required headers
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Health check endpoints
@app.get("/health", tags=["health"])
async def health_check():
    """Liveness probe - Basit health check"""
    return {"status": "healthy", "service": "coupon-api"}

@app.get("/ready", tags=["health"])
async def readiness_check():
    """Readiness probe - Database bağlantı kontrolü"""
    try:
        from shared.database import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {
            "status": "ready",
            "database": "connected",
            "mailgun": "configured" if settings.MAILGUN_API_KEY else "not-configured"
        }
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "not-ready", "error": str(e)}
        )

# Include routers
app.include_router(auth_router)
app.include_router(participation_router)
app.include_router(admin_router)
app.include_router(events_router)
app.include_router(user_stats_router)
app.include_router(client_router)
from backend_api.app.routers.leagues import router as leagues_router
app.include_router(leagues_router)

# Mount static files
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Kupon Turnuvası API başlatıldı")
    
    # Auto-create tables for new models (safe for existing tables)
    try:
        from shared.database import engine, Base
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables verified/created")
    except Exception as e:
        logger.error(f"❌ Table creation failed: {e}")

    
    # Mailgun yapılandırma kontrolü
    if settings.MAILGUN_API_KEY and settings.MAILGUN_DOMAIN:
        logger.info("📧 Email provider: Mailgun (✅ TAM YAPILANDIRILMIŞ)")
        logger.info(f"   ├─ Domain: {settings.MAILGUN_DOMAIN}")
        logger.info(f"   ├─ From: {settings.MAILGUN_FROM_NAME} <{settings.MAILGUN_FROM_EMAIL}>")
        logger.info(f"   └─ API Endpoint: {settings.MAILGUN_BASE_URL}")
    elif settings.MAILGUN_API_KEY:
        logger.warning("⚠️ Email provider: Mailgun (❌ DOMAIN EKSİK)")
        logger.warning("   MAILGUN_DOMAIN değişkeni .env dosyasında tanımlanmalı!")
    elif settings.MAILGUN_DOMAIN:
        logger.warning("⚠️ Email provider: Mailgun (❌ API KEY EKSİK)")
        logger.warning("   MAILGUN_API_KEY değişkeni .env dosyasında tanımlanmalı!")
    else:
        logger.warning("⚠️ Email provider: Mailgun (❌ YAPILANDIRILMAMIŞ)")
        logger.warning("   Admin panel login çalışmayacak! .env dosyasına şunları ekleyin:")
        logger.warning("   - MAILGUN_API_KEY")
        logger.warning("   - MAILGUN_DOMAIN")
    
    logger.info(f"🔒 CORS origins: {', '.join(allowed_origins)}")
