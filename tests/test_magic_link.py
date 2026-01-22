from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import pytest
from shared.models.admin import AdminUser
from shared.models.magic_token import MagicToken
from backend_api.app.security import get_password_hash
from backend_api.app.deps import get_db, verify_api_token
from backend_api.app.main import app

def test_magic_link_flow(db_session: Session):
    # Override get_db to use the SAME session as the test setup
    def override_get_db_local():
        yield db_session
    
    # Override verify_api_token to allow anything (or we will test it specifically later)
    # But for the *request* part, we don't need token.
    # For *verify* part, we don't need token.
    # For *stats* part, we DO need proper verification which we will test effectively by NOT overriding key checks
    # but verify_api_token dependency logic itself. 
    # BUT wait, app.dependency_overrides might be contaminated by other tests if we are not careful?
    # Pytest usually isolates if we use fixtures carefully.
    
    app.dependency_overrides = {}
    app.dependency_overrides[get_db] = override_get_db_local
    
    # 1. Setup: Create a test admin user
    email = "testadmin@example.com"
    username = "magicadmin"
    
    user = AdminUser(
        username=username,
        email=email,
        hashed_password=get_password_hash("secret"),
        role="admin"
    )
    db_session.add(user)
    db_session.commit()
    
    # Manually create client
    with TestClient(app) as client:
        # 2. Request Magic Link
        response = client.post("/auth/magic-link", json={"email": email})
        assert response.status_code == 200, f"Response: {response.text}"
        assert response.json()["message"] == "Giriş linki e-posta adresinize gönderildi."
        
        # 3. "Intercept" the token from DB
        magic_token = db_session.query(MagicToken).filter(MagicToken.user_id == user.id).order_by(MagicToken.id.desc()).first()
        assert magic_token is not None
        assert magic_token.is_used is False
        
        token_str = magic_token.token
        
        # 4. Verify Token
        verify_res = client.post("/auth/verify-magic-link", json={"token": token_str})
        assert verify_res.status_code == 200
        data = verify_res.json()
        assert "access_token" in data
        
        jwt_token = data["access_token"]
        
        # 5. Access Protected Route with JWT
        headers = {"X-API-Key": jwt_token}
        stats_res = client.get("/admin/stats", headers=headers)
        if stats_res.status_code != 200:
             print(f"Stats failed: {stats_res.text}")
        assert stats_res.status_code == 200
        
        # 6. Verify Token is marked as used
        db_session.expire_all() # Ensure we fetch fresh data
        magic_token = db_session.query(MagicToken).filter(MagicToken.id == magic_token.id).first()
        assert magic_token.is_used is True
        
        # 7. Try to use valid token again (should fail)
        verify_res_2 = client.post("/auth/verify-magic-link", json={"token": token_str})
        assert verify_res_2.status_code == 400
