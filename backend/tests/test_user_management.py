"""
Test User Management Features:
1. Toggle User Active/Inactive (PATCH /api/users/{user_id}/toggle-active)
2. Update User Permissions (PATCH /api/users/{user_id}/permissions)
3. Reset User Password (PATCH /api/users/{user_id}/password)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "admin@usbakers.com"
SUPER_ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get super admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


@pytest.fixture(scope="module")
def test_user(api_client):
    """Create a test user for testing user management features"""
    unique_id = str(uuid.uuid4())[:8]
    user_data = {
        "email": f"TEST_user_{unique_id}@test.com",
        "name": f"TEST User {unique_id}",
        "phone": "1234567890",
        "role": "order_manager",
        "permissions": ["can_view_orders", "can_create_order"],
        "password": "testpassword123"
    }
    
    response = api_client.post(f"{BASE_URL}/api/users", json=user_data)
    assert response.status_code == 200, f"Failed to create test user: {response.text}"
    
    user = response.json()
    yield user
    
    # Cleanup: No delete endpoint available, so we leave user in inactive state
    # api_client.delete(f"{BASE_URL}/api/users/{user['id']}")


class TestUserManagementAuth:
    """Test authentication for user management endpoints"""
    
    def test_login_super_admin(self):
        """Test super admin can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "super_admin"
        print("✓ Super admin login successful")
    
    def test_get_users_list(self, api_client):
        """Test fetching all users"""
        response = api_client.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) > 0
        print(f"✓ Got {len(users)} users")


class TestToggleUserActive:
    """Test Activate/Deactivate User functionality"""
    
    def test_deactivate_user(self, api_client, test_user):
        """Test deactivating an active user"""
        user_id = test_user["id"]
        
        # User should be active by default
        assert test_user["is_active"] == True
        
        # Toggle to deactivate
        response = api_client.patch(f"{BASE_URL}/api/users/{user_id}/toggle-active")
        assert response.status_code == 200
        data = response.json()
        assert "deactivated" in data["message"].lower()
        print(f"✓ User deactivated: {data['message']}")
        
        # Verify user is now inactive
        users_response = api_client.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        user = next((u for u in users if u["id"] == user_id), None)
        assert user is not None
        assert user["is_active"] == False
        print("✓ Verified user is now inactive")
    
    def test_activate_user(self, api_client, test_user):
        """Test activating an inactive user"""
        user_id = test_user["id"]
        
        # Toggle to activate (user was deactivated in previous test)
        response = api_client.patch(f"{BASE_URL}/api/users/{user_id}/toggle-active")
        assert response.status_code == 200
        data = response.json()
        assert "activated" in data["message"].lower()
        print(f"✓ User activated: {data['message']}")
        
        # Verify user is now active
        users_response = api_client.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        user = next((u for u in users if u["id"] == user_id), None)
        assert user is not None
        assert user["is_active"] == True
        print("✓ Verified user is now active")
    
    def test_toggle_nonexistent_user(self, api_client):
        """Test toggling a non-existent user returns 404"""
        response = api_client.patch(f"{BASE_URL}/api/users/nonexistent-id-12345/toggle-active")
        assert response.status_code == 404
        print("✓ Non-existent user toggle returns 404")


class TestUserPermissions:
    """Test Edit User Permissions functionality"""
    
    def test_get_available_permissions(self, api_client):
        """Test fetching available permissions"""
        response = api_client.get(f"{BASE_URL}/api/permissions/available")
        assert response.status_code == 200
        permissions = response.json()
        
        # Verify permission categories exist
        assert "orders" in permissions
        assert "order_fields" in permissions
        assert "payments" in permissions
        assert "management" in permissions
        assert "delivery" in permissions
        
        # Verify specific permissions in orders category
        assert "can_create_order" in permissions["orders"]
        assert "can_view_orders" in permissions["orders"]
        print(f"✓ Got available permissions: {list(permissions.keys())}")
    
    def test_update_user_permissions(self, api_client, test_user):
        """Test updating user permissions"""
        user_id = test_user["id"]
        
        # New permissions to set
        new_permissions = {
            "permissions": [
                "can_view_orders",
                "can_create_order",
                "can_edit_orders",
                "can_record_payment"
            ]
        }
        
        response = api_client.patch(
            f"{BASE_URL}/api/users/{user_id}/permissions",
            json=new_permissions
        )
        assert response.status_code == 200
        data = response.json()
        assert "permissions" in data["message"].lower() or "updated" in data["message"].lower()
        print(f"✓ Permissions updated: {data['message']}")
        
        # Verify permissions were updated
        users_response = api_client.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        user = next((u for u in users if u["id"] == user_id), None)
        assert user is not None
        assert set(user["permissions"]) == set(new_permissions["permissions"])
        print(f"✓ Verified user has new permissions: {user['permissions']}")
    
    def test_clear_user_permissions(self, api_client, test_user):
        """Test clearing all user permissions"""
        user_id = test_user["id"]
        
        response = api_client.patch(
            f"{BASE_URL}/api/users/{user_id}/permissions",
            json={"permissions": []}
        )
        assert response.status_code == 200
        print("✓ Cleared user permissions")
        
        # Verify permissions were cleared
        users_response = api_client.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        user = next((u for u in users if u["id"] == user_id), None)
        assert user is not None
        assert user["permissions"] == []
        print("✓ Verified user has no permissions")
    
    def test_update_permissions_nonexistent_user(self, api_client):
        """Test updating permissions for non-existent user returns 404"""
        response = api_client.patch(
            f"{BASE_URL}/api/users/nonexistent-id-12345/permissions",
            json={"permissions": ["can_view_orders"]}
        )
        assert response.status_code == 404
        print("✓ Non-existent user permissions update returns 404")


class TestResetPassword:
    """Test Reset User Password functionality"""
    
    def test_reset_password_success(self, api_client, test_user):
        """Test resetting user password with valid password"""
        user_id = test_user["id"]
        user_email = test_user["email"]
        new_password = "newpassword123"
        
        response = api_client.patch(
            f"{BASE_URL}/api/users/{user_id}/password",
            json={"password": new_password}
        )
        assert response.status_code == 200
        data = response.json()
        assert "password" in data["message"].lower() or "reset" in data["message"].lower()
        print(f"✓ Password reset: {data['message']}")
        
        # Verify new password works by trying to login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": user_email, "password": new_password}
        )
        assert login_response.status_code == 200
        print(f"✓ Login with new password successful for {user_email}")
    
    def test_reset_password_too_short(self, api_client, test_user):
        """Test password reset fails if password is less than 6 characters"""
        user_id = test_user["id"]
        
        response = api_client.patch(
            f"{BASE_URL}/api/users/{user_id}/password",
            json={"password": "12345"}  # 5 characters - too short
        )
        assert response.status_code == 400
        data = response.json()
        assert "6" in str(data.get("detail", "")) or "character" in str(data.get("detail", "")).lower()
        print(f"✓ Short password rejected: {data.get('detail')}")
    
    def test_reset_password_exactly_six_chars(self, api_client, test_user):
        """Test password reset succeeds with exactly 6 characters"""
        user_id = test_user["id"]
        
        response = api_client.patch(
            f"{BASE_URL}/api/users/{user_id}/password",
            json={"password": "abc123"}  # Exactly 6 characters
        )
        assert response.status_code == 200
        print("✓ 6-character password accepted")
    
    def test_reset_password_nonexistent_user(self, api_client):
        """Test password reset for non-existent user returns 404"""
        response = api_client.patch(
            f"{BASE_URL}/api/users/nonexistent-id-12345/password",
            json={"password": "validpassword123"}
        )
        assert response.status_code == 404
        print("✓ Non-existent user password reset returns 404")


class TestUnauthorizedAccess:
    """Test that non-super-admin users cannot access user management"""
    
    def test_toggle_active_requires_auth(self):
        """Test toggle active requires authentication"""
        response = requests.patch(f"{BASE_URL}/api/users/some-id/toggle-active")
        assert response.status_code in [401, 403]
        print("✓ Toggle active requires authentication")
    
    def test_permissions_update_requires_auth(self):
        """Test permissions update requires authentication"""
        response = requests.patch(
            f"{BASE_URL}/api/users/some-id/permissions",
            json={"permissions": []}
        )
        assert response.status_code in [401, 403]
        print("✓ Permissions update requires authentication")
    
    def test_password_reset_requires_auth(self):
        """Test password reset requires authentication"""
        response = requests.patch(
            f"{BASE_URL}/api/users/some-id/password",
            json={"password": "newpassword"}
        )
        assert response.status_code in [401, 403]
        print("✓ Password reset requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
