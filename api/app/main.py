from fastapi import FastAPI
from app.database import Base, engine
from app.routers.participation import router as participation_router

# TABLOLARI OLUŞTUR
Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(participation_router, prefix="/api")

@app.get("/")
def health():
    return {"status": "API is running"}
