"""
Tests for authentication endpoints
"""
import pytest
from fastapi.testclient import TestClient
from django.contrib.auth import get_user_model

from api.main import app
from core.security import hash_password

User = get_user_model()
client = TestClient(app)


@pytest.fixture
def test_user(db):
    """Create a test user"""
    user = User.objects.create_user(
        email="test@example.com",
        password="TestPass123!",
        is_email_verified=True
    )
    return user


@pytest.fixture
def unverified_user(db):
    """Create an unverified test user"""
    user = User.objects.create_user(
        email="unverified@example.com",
        password="TestPass123!",
        is_email_verified=False
    )
    return user


class TestUserRegistration:
    """Test user registration endpoint"""
    
    def test_register_success(self, db):
        """Test successful user registration"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "StrongPass123!",
            }
        )
        
        assert response.status_code == 201
        assert "registered successfully" in response.json()["message"]
        
        # Verify user was created
        user = User.objects.get(email="newuser@example.com")
        assert user is not None
        assert user.is_email_verified is False
    
    def test_register_with_phone(self, db):
        """Test registration with phone number"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "phone@example.com",
                "password": "StrongPass123!",
                "phone_number": "+1234567890"
            }
        )
        
        assert response.status_code == 201
        user = User.objects.get(email="phone@example.com")
        assert user.phone_number == "+1234567890"
    
    def test_register_duplicate_email(self, db, test_user):
        """Test registration with existing email"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com",
                "password": "StrongPass123!",
            }
        )
        
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]
    
    def test_register_weak_password(self, db):
        """Test registration with weak password"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "weak@example.com",
                "password": "weak",
            }
        )
        
        assert response.status_code == 400
    
    def test_register_invalid_email(self, db):
        """Test registration with invalid email"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "invalid-email",
                "password": "StrongPass123!",
            }
        )
        
        assert response.status_code == 422  # Validation error


class TestUserLogin:
    """Test user login endpoint"""
    
    def test_login_success(self, db, test_user):
        """Test successful login"""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "TestPass123!",
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_wrong_password(self, db, test_user):
        """Test login with wrong password"""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "WrongPassword123!",
            }
        )
        
        assert response.status_code == 401
        assert "Incorrect" in response.json()["detail"]
    
    def test_login_nonexistent_user(self, db):
        """Test login with non-existent user"""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "TestPass123!",
            }
        )
        
        assert response.status_code == 401


class TestTokenRefresh:
    """Test token refresh endpoint"""
    
    def test_refresh_success(self, db, test_user):
        """Test successful token refresh"""
        # First login to get tokens
        login_response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "TestPass123!",
            }
        )
        
        refresh_token = login_response.json()["refresh_token"]
        
        # Refresh token
        response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
    
    def test_refresh_invalid_token(self, db):
        """Test refresh with invalid token"""
        response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": "invalid_token"}
        )
        
        assert response.status_code == 401


class TestGetCurrentUser:
    """Test get current user endpoint"""
    
    def test_get_user_success(self, db, test_user):
        """Test getting current user info"""
        # Login first
        login_response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "TestPass123!",
            }
        )
        
        access_token = login_response.json()["access_token"]
        
        # Get user info
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert "id" in data
        assert "kyc_tier" in data
    
    def test_get_user_no_token(self, db):
        """Test getting user info without token"""
        response = client.get("/api/auth/me")
        
        assert response.status_code == 403  # Forbidden (no auth)
    
    def test_get_user_invalid_token(self, db):
        """Test getting user info with invalid token"""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401


class TestPasswordReset:
    """Test password reset endpoints"""
    
    def test_request_reset_success(self, db, test_user):
        """Test requesting password reset"""
        response = client.post(
            "/api/auth/request-reset",
            json={"email": "test@example.com"}
        )
        
        assert response.status_code == 200
        assert "reset link" in response.json()["message"]
    
    def test_request_reset_nonexistent_email(self, db):
        """Test requesting reset for non-existent email"""
        response = client.post(
            "/api/auth/request-reset",
            json={"email": "nonexistent@example.com"}
        )
        
        # Should still return success (security: don't reveal if email exists)
        assert response.status_code == 200


class TestPasswordChange:
    """Test password change endpoint"""
    
    def test_change_password_success(self, db, test_user):
        """Test successful password change"""
        # Login first
        login_response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "TestPass123!",
            }
        )
        
        access_token = login_response.json()["access_token"]
        
        # Change password
        response = client.post(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "current_password": "TestPass123!",
                "new_password": "NewStrongPass123!"
            }
        )
        
        assert response.status_code == 200
        assert "changed successfully" in response.json()["message"]
        
        # Verify new password works
        login_response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "NewStrongPass123!",
            }
        )
        assert login_response.status_code == 200
    
    def test_change_password_wrong_current(self, db, test_user):
        """Test password change with wrong current password"""
        # Login first
        login_response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "TestPass123!",
            }
        )
        
        access_token = login_response.json()["access_token"]
        
        # Try to change with wrong current password
        response = client.post(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "current_password": "WrongPassword!",
                "new_password": "NewStrongPass123!"
            }
        )
        
        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()
