"""
Backend tests for iteration changes:
- HEIC upload conversion
- Approval-based order delete
- Production-sheet endpoint
- Time-slot capacity endpoint
- Customers Excel import
- Kitchen orders deadline enrichment
- SystemSettings.max_orders_per_time_slot
- Order base_size field
- Time-slot enforcement on order create
"""
import os
import io
import uuid
import pytest
import requests
from datetime import datetime, timedelta
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sweet-creations-166.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@usbakers.com"
ADMIN_PASSWORD = "admin123"
MANAGER_EMAIL = "manager@usbakers.com"
MANAGER_PASSWORD = "manager123"


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def manager_token():
    r = requests.post(f"{API}/auth/login", json={"email": MANAGER_EMAIL, "password": MANAGER_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Manager login failed (seed_data.py may not have been run): {r.status_code}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def manager_headers(manager_token):
    return {"Authorization": f"Bearer {manager_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def outlet_id(admin_headers):
    r = requests.get(f"{API}/outlets", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    outlets = r.json()
    if not outlets:
        # Create one outlet
        payload = {
            "name": "TEST_OUTLET",
            "address": "1 Test St",
            "city": "Mumbai",
            "phone": "1112223333",
            "username": f"test_outlet_{uuid.uuid4().hex[:6]}",
            "password": "outlet123",
            "ready_time_buffer_minutes": 45,
        }
        r2 = requests.post(f"{API}/outlets", headers=admin_headers, json=payload, timeout=15)
        assert r2.status_code in (200, 201), r2.text
        return r2.json()["id"]
    return outlets[0]["id"]


# ---------- 1. Auth ----------

class TestAuth:
    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20


# ---------- 2. System settings ----------

class TestSystemSettings:
    def test_get_settings_has_max_orders_field(self, admin_headers):
        r = requests.get(f"{API}/system-settings", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "max_orders_per_time_slot" in data
        assert "minimum_payment_percentage" in data
        assert "birthday_mandatory" in data

    def test_patch_settings_updates_all_fields(self, admin_headers):
        payload = {
            "minimum_payment_percentage": 25.0,
            "birthday_mandatory": True,
            "max_orders_per_time_slot": 5,
        }
        r = requests.patch(f"{API}/system-settings", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        # Verify GET reflects update
        r2 = requests.get(f"{API}/system-settings", headers=admin_headers, timeout=15)
        d = r2.json()
        assert d["minimum_payment_percentage"] == 25.0
        assert d["birthday_mandatory"] is True
        assert d["max_orders_per_time_slot"] == 5


# ---------- 3. Image upload ----------

def _make_jpeg_bytes():
    img = Image.new("RGB", (40, 40), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_heic_like_jpeg_bytes():
    """We don't have a real HEIC encoder available reliably. Server's HEIC path uses PIL.Image.open
    which works on many formats. Test the .heic content-type/filename branch using a JPEG byte stream;
    pillow will still open it and re-save as JPEG (this exercises the conversion code path)."""
    return _make_jpeg_bytes()


class TestUploadImage:
    def test_upload_jpeg(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        files = {"file": ("test.jpg", _make_jpeg_bytes(), "image/jpeg")}
        r = requests.post(f"{API}/upload-image", headers=headers, files=files, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and "file_url" in data
        assert data["url"].startswith("/api/uploads/")

    def test_upload_heic_returns_jpg(self, admin_token):
        """HEIC code path: filename ending in .heic with content-type image/heic should be auto-converted to .jpg"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        files = {"file": ("photo.heic", _make_heic_like_jpeg_bytes(), "image/heic")}
        r = requests.post(f"{API}/upload-image", headers=headers, files=files, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["url"].endswith(".jpg"), f"Expected .jpg URL, got {data['url']}"
        assert data["filename"].endswith(".jpg")


# ---------- 4. Production sheet ----------

class TestProductionSheet:
    def test_get_production_sheet_returns_structure(self, admin_headers):
        r = requests.get(f"{API}/factory/production-sheet", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "date" in data
        assert "total_orders" in data
        assert "groups" in data
        assert isinstance(data["groups"], list)


# ---------- 5. Time-slot capacity ----------

class TestTimeSlotCapacity:
    def test_capacity_endpoint(self, admin_headers, outlet_id):
        future = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        params = {"outlet_id": outlet_id, "delivery_date": future, "delivery_time": "14:00"}
        r = requests.get(f"{API}/orders/time-slot-capacity", headers=admin_headers, params=params, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("count", "limit", "exceeded"):
            assert k in d


# ---------- 6. Approval-based delete ----------

def _create_order_payload(outlet_id, future_date, time_str="13:00"):
    return {
        "order_type": "self",
        "customer_info": {"name": "TEST_Customer", "phone": "9999000011"},
        "needs_delivery": False,
        "flavour": "Chocolate",
        "size_pounds": 1.0,
        "base_size": 1.0,
        "cake_image_url": "/api/uploads/test.jpg",
        "delivery_date": future_date,
        "delivery_time": time_str,
        "outlet_id": outlet_id,
        "total_amount": 500.0,
    }


class TestApprovalDelete:
    @pytest.fixture
    def created_order_id_admin(self, admin_headers, outlet_id):
        future = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        # Disable slot cap
        requests.patch(f"{API}/system-settings", headers=admin_headers, json={"minimum_payment_percentage": 25.0, "max_orders_per_time_slot": 0}, timeout=15)
        payload = _create_order_payload(outlet_id, future, "10:00")
        r = requests.post(f"{API}/orders", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        return body.get("order_id") or body.get("id")

    def test_delete_without_reason_returns_400(self, admin_headers, created_order_id_admin):
        r = requests.delete(f"{API}/orders/{created_order_id_admin}", headers=admin_headers, timeout=15)
        assert r.status_code == 400, r.text

    def test_super_admin_delete_with_reason(self, admin_headers, created_order_id_admin):
        r = requests.delete(
            f"{API}/orders/{created_order_id_admin}",
            headers=admin_headers,
            params={"reason": "test cleanup"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # Verify is_deleted=true via deleted listing
        r2 = requests.get(f"{API}/orders/deleted", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        ids = [o["id"] for o in r2.json()]
        assert created_order_id_admin in ids

    def test_non_super_admin_delete_creates_request_and_approval(self, admin_headers, manager_headers, outlet_id):
        # Create order as admin
        future = (datetime.now() + timedelta(days=11)).strftime("%Y-%m-%d")
        requests.patch(f"{API}/system-settings", headers=admin_headers, json={"minimum_payment_percentage": 25.0, "max_orders_per_time_slot": 0}, timeout=15)
        payload = _create_order_payload(outlet_id, future, "11:00")
        rc = requests.post(f"{API}/orders", headers=admin_headers, json=payload, timeout=15)
        assert rc.status_code in (200, 201), rc.text
        oid = rc.json().get("order_id") or rc.json().get("id")

        # Manager attempts delete with reason
        r = requests.delete(f"{API}/orders/{oid}", headers=manager_headers, params={"reason": "wrong details"}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "approval" in body.get("message", "").lower()

        # delete-requests should include this
        r2 = requests.get(f"{API}/orders/delete-requests", headers=admin_headers, timeout=15)
        assert r2.status_code == 200, r2.text
        ids = [o["id"] for o in r2.json()]
        assert oid in ids

        # Approve as super admin
        r3 = requests.post(f"{API}/orders/{oid}/approve-delete", headers=admin_headers, timeout=15)
        assert r3.status_code == 200, r3.text

        # Verify deleted
        r4 = requests.get(f"{API}/orders/deleted", headers=admin_headers, timeout=15)
        assert oid in [o["id"] for o in r4.json()]


# ---------- 7. Customers Import ----------

class TestCustomersImport:
    def test_import_inserts_and_updates(self, admin_headers):
        phone = f"9999{uuid.uuid4().int % 1000000:06d}"
        payload = {"rows": [
            {"name": "TEST_Imp_A", "phone": phone, "email": "a@x.com", "birthday": "1990-01-01"},
            {"name": "TEST_Imp_B", "phone": ""},  # invalid -> errors
        ]}
        r = requests.post(f"{API}/customers/import", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["inserted"] >= 1
        assert isinstance(d["errors"], list) and len(d["errors"]) >= 1
        # Re-import same phone -> should update
        r2 = requests.post(f"{API}/customers/import", headers=admin_headers, json={"rows": [{"name": "TEST_Imp_A2", "phone": phone}]}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["updated"] >= 1


# ---------- 8. Kitchen orders deadline enrichment ----------

class TestKitchenDeadline:
    def test_kitchen_orders_have_deadline(self, admin_headers):
        r = requests.get(f"{API}/kitchen/orders", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        orders = r.json()
        if not orders:
            pytest.skip("No kitchen orders to verify enrichment")
        # At least one order should have ready_time_buffer_minutes
        sample = orders[0]
        assert "ready_time_buffer_minutes" in sample
        assert "kitchen_ready_deadline" in sample


# ---------- 9. Time-slot cap enforcement ----------

class TestTimeSlotEnforcement:
    def test_second_order_409(self, admin_headers, outlet_id):
        # Set cap = 1
        r = requests.patch(f"{API}/system-settings", headers=admin_headers, json={"minimum_payment_percentage": 25.0, "max_orders_per_time_slot": 1}, timeout=15)
        assert r.status_code == 200
        # Use a unique date (avoid prior runs polluting the slot)
        future = (datetime.now() + timedelta(days=180 + (uuid.uuid4().int % 60))).strftime("%Y-%m-%d")
        slot = f"{(uuid.uuid4().int % 12) + 8:02d}:{(uuid.uuid4().int % 6) * 10:02d}"
        p1 = _create_order_payload(outlet_id, future, slot)
        r1 = requests.post(f"{API}/orders", headers=admin_headers, json=p1, timeout=15)
        assert r1.status_code in (200, 201), f"First order should succeed: {r1.status_code} {r1.text}"

        p2 = _create_order_payload(outlet_id, future, slot)
        r2 = requests.post(f"{API}/orders", headers=admin_headers, json=p2, timeout=15)
        assert r2.status_code == 409, f"Expected 409 for full slot, got {r2.status_code}: {r2.text}"
        assert "fully booked" in r2.text.lower() or "full" in r2.text.lower()

        # Reset cap
        requests.patch(f"{API}/system-settings", headers=admin_headers, json={"minimum_payment_percentage": 25.0, "max_orders_per_time_slot": 0}, timeout=15)


# ---------- 10. Regression - existing routes ----------

class TestRegression:
    def test_outlets_list(self, admin_headers):
        r = requests.get(f"{API}/outlets", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_zones_list(self, admin_headers):
        r = requests.get(f"{API}/zones", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_orders_list(self, admin_headers):
        # GET /orders is intentionally absent; /orders/manage is the canonical list endpoint
        r = requests.get(f"{API}/orders/manage", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_kitchen_list(self, admin_headers):
        r = requests.get(f"{API}/kitchen/orders", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_customers_list(self, admin_headers):
        r = requests.get(f"{API}/customers", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_factory_orders(self, admin_headers):
        r = requests.get(f"{API}/factory/orders", headers=admin_headers, timeout=15)
        assert r.status_code == 200
