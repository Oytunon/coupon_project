from fastapi.testclient import TestClient
from backend_api.app.main import app
from shared.settings import settings
from backend_api.app.deps import get_db, verify_api_token
import pytest

# Manually clear overrides for this validation
@pytest.fixture
def secure_client(db_session):
    # We want to test REAL security, so we remove the override for verify_api_token
    # But we keep get_db override to use the test database
    app.dependency_overrides = {}
    
    # Re-apply ONLY get_db override
    def override_get_db_local():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db_local
    
    # Ensure API_TOKEN is set for the test
    original_token = settings.API_TOKEN
    settings.API_TOKEN = "test-secret-key"
    
    with TestClient(app) as c:
        yield c
        
    # Restore settings
    settings.API_TOKEN = original_token
    # Restore overrides (optional, but good practice if tests ran in same process)
    # app.dependency_overrides = ... (handled by other fixtures usually)

def test_admin_access_without_token(secure_client):
    response = secure_client.get("/admin/stats")
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required (API Key or JWT)"

def test_admin_access_with_invalid_token(secure_client):
    response = secure_client.get("/admin/stats", headers={"X-API-Key": "wrong-key"})
    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid authentication credentials"

def test_admin_access_with_valid_token(secure_client):
    response = secure_client.get("/admin/stats", headers={"X-API-Key": "test-secret-key"})
    assert response.status_code == 200
