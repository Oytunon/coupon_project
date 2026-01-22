import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from backend_api.app.main import app
from shared.database import Base, get_db_session
from backend_api.app.deps import get_db, verify_api_token

# InMemory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency override
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

def override_verify_api_token():
    return True

@pytest.fixture(scope="session")
def db_engine():
    # Create tables once for the session (or module if preferred, but session is faster if no side effects)
    # However, with in-memory sqlite, we need to be careful.
    # Let's use module scope to be safe and consistent with previous client fixture.
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(db_engine):
    # Setup for each test function
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module")
def client():
    # Ensure tables exist (redundant if using db_engine but safe)
    Base.metadata.create_all(bind=engine)
    
    # Apply overrides
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[verify_api_token] = override_verify_api_token
    
    with TestClient(app) as c:
        yield c
    
    # Drop tables
    Base.metadata.drop_all(bind=engine)
