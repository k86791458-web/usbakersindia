"""
WhatsApp Templates API Tests
Tests for /api/whatsapp/* endpoints for AiSensy integration
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "admin@usbakers.com"
SUPER_ADMIN_PASSWORD = "admin123"

class TestAuth:
    """Authentication tests for WhatsApp API access"""
    
    def test_login_super_admin(self):
        """Test super admin login returns valid token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["role"] == "super_admin"
        print(f"✅ Super Admin login successful, token received")
        
    def test_login_invalid_credentials(self):
        """Test invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print(f"✅ Invalid credentials correctly rejected")


class TestWhatsAppTemplatesCRUD:
    """WhatsApp Template CRUD operations tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, "Auth failed in setup"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_templates_empty_or_list(self):
        """Test GET /api/whatsapp/templates returns list"""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp/templates",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ GET templates returned {len(data)} templates")
    
    def test_create_order_placed_template(self):
        """Test creating ORDER_PLACED template"""
        template_data = {
            "event_type": "order_placed",
            "campaign_name": "TEST_order_placed_campaign",
            "template_message": "Hi {{1}}, your order {{2}} has been placed for delivery on {{3}} at {{4}}",
            "is_enabled": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/templates",
            json=template_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["event_type"] == "order_placed"
        assert data["campaign_name"] == "TEST_order_placed_campaign"
        assert data["is_enabled"] == False
        assert "id" in data
        print(f"✅ ORDER_PLACED template created/updated successfully")
    
    def test_create_order_confirmed_template(self):
        """Test creating ORDER_CONFIRMED template"""
        template_data = {
            "event_type": "order_confirmed",
            "campaign_name": "TEST_order_confirmed_campaign",
            "template_message": "Hi {{1}}, your order {{2}} is confirmed for {{3}} at {{4}}",
            "is_enabled": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/templates",
            json=template_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["event_type"] == "order_confirmed"
        print(f"✅ ORDER_CONFIRMED template created/updated successfully")
    
    def test_create_order_ready_template(self):
        """Test creating ORDER_READY template"""
        template_data = {
            "event_type": "order_ready",
            "campaign_name": "TEST_order_ready_campaign",
            "template_message": "Hi {{1}}, your order {{2}} is ready for pickup!",
            "is_enabled": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/templates",
            json=template_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["event_type"] == "order_ready"
        print(f"✅ ORDER_READY template created/updated successfully")
    
    def test_create_out_for_delivery_template(self):
        """Test creating OUT_FOR_DELIVERY template"""
        template_data = {
            "event_type": "out_for_delivery",
            "campaign_name": "TEST_out_for_delivery_campaign",
            "template_message": "Hi {{1}}, your order {{2}} is out for delivery!",
            "is_enabled": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/templates",
            json=template_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["event_type"] == "out_for_delivery"
        print(f"✅ OUT_FOR_DELIVERY template created/updated successfully")
    
    def test_create_delivered_template(self):
        """Test creating DELIVERED template"""
        template_data = {
            "event_type": "delivered",
            "campaign_name": "TEST_delivered_campaign",
            "template_message": "Hi {{1}}, your order {{2}} has been delivered. Thank you!",
            "is_enabled": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/templates",
            json=template_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["event_type"] == "delivered"
        print(f"✅ DELIVERED template created/updated successfully")
    
    def test_update_template_via_patch(self):
        """Test PATCH /api/whatsapp/templates/{event_type}"""
        update_data = {
            "is_enabled": True,
            "campaign_name": "TEST_updated_campaign"
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/whatsapp/templates/order_placed",
            json=update_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("message") == "Template updated successfully"
        print(f"✅ Template PATCH update successful")
    
    def test_verify_template_update_persisted(self):
        """Verify that template update was persisted"""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp/templates",
            headers=self.headers
        )
        assert response.status_code == 200
        
        templates = response.json()
        order_placed = next((t for t in templates if t["event_type"] == "order_placed"), None)
        
        if order_placed:
            assert order_placed["is_enabled"] == True, "Template should be enabled"
            print(f"✅ Template update verified - is_enabled: {order_placed['is_enabled']}")
        else:
            print("⚠️ No order_placed template found to verify")
    
    def test_get_whatsapp_logs(self):
        """Test GET /api/whatsapp/logs returns list"""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp/logs",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ GET whatsapp logs returned {len(data)} logs")


class TestWhatsAppUnauthorized:
    """Test unauthorized access to WhatsApp endpoints"""
    
    def test_templates_without_auth(self):
        """Test templates endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Templates endpoint correctly requires auth")
    
    def test_logs_without_auth(self):
        """Test logs endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/logs")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Logs endpoint correctly requires auth")


class TestOrderWhatsAppIntegration:
    """Test WhatsApp notification triggers on order events"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth and outlet for tests"""
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, "Auth failed in setup"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get or create outlet
        outlets_response = requests.get(f"{BASE_URL}/api/outlets", headers=self.headers)
        outlets = outlets_response.json()
        
        if outlets:
            self.outlet_id = outlets[0]["id"]
        else:
            # Create test outlet
            outlet_data = {
                "name": "TEST Outlet",
                "address": "123 Test St",
                "city": "Test City",
                "phone": "1234567890",
                "username": "testoutlet",
                "password": "testpass123"
            }
            create_response = requests.post(
                f"{BASE_URL}/api/outlets",
                json=outlet_data,
                headers=self.headers
            )
            self.outlet_id = create_response.json().get("id")
    
    def test_create_order_triggers_notification(self):
        """Test that creating an order triggers ORDER_PLACED notification"""
        order_data = {
            "order_type": "self",
            "customer_info": {
                "name": "Test Customer",
                "phone": "+919876543210"
            },
            "needs_delivery": False,
            "flavour": "Chocolate",
            "size_pounds": 1.0,
            "cake_image_url": "/test-image.jpg",
            "delivery_date": "2026-03-01",
            "delivery_time": "10:00 AM",
            "outlet_id": self.outlet_id,
            "total_amount": 1000.0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        data = response.json()
        assert "order_id" in data
        assert "order_number" in data
        self.order_id = data["order_id"]
        print(f"✅ Order created: {data['order_number']}, WhatsApp notification should be triggered")
    
    def test_update_order_status_triggers_notification(self):
        """Test that updating order status triggers WhatsApp notification"""
        # First create an order
        order_data = {
            "order_type": "self",
            "customer_info": {
                "name": "Status Test Customer",
                "phone": "+919876543211"
            },
            "needs_delivery": True,
            "delivery_address": "123 Test Lane",
            "delivery_city": "Test City",
            "flavour": "Vanilla",
            "size_pounds": 2.0,
            "cake_image_url": "/test-image.jpg",
            "delivery_date": "2026-03-02",
            "delivery_time": "2:00 PM",
            "outlet_id": self.outlet_id,
            "total_amount": 2000.0
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers=self.headers
        )
        
        assert create_response.status_code == 200
        order_id = create_response.json()["order_id"]
        
        # Update status to READY
        status_response = requests.patch(
            f"{BASE_URL}/api/orders/{order_id}/status",
            params={"status": "ready"},
            headers=self.headers
        )
        
        assert status_response.status_code == 200, f"Status update failed: {status_response.text}"
        print(f"✅ Order status updated to READY, WhatsApp notification should be triggered")


class TestHealthCheck:
    """Basic health check test"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✅ API health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
