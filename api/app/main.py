from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from common.database import Base, engine
from common.settings import settings
from common.models.coupon import Coupon  # Ensure Coupon model is registered
from app.routers.participation import router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Coupon API")

# CORS ayarları - Frontend'den istekler için
# Production'da FRONTEND_URL environment variable'ından alınır
# Development'ta localhost portları kullanılır
if settings.FRONTEND_URL:
    # Production: FRONTEND_URL environment variable'ından al
    allowed_origins = [settings.FRONTEND_URL]
else:
    # Development: Vite default portları
    allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
