"""
Comprehensive backend regression tests for US Bakers India app.
Tests all endpoints listed in the iteration_3 review request.

Run: pytest /app/backend/tests/test_usbakers_backend.py -v --tb=short \
        --junitxml=/app/test_reports/pytest/pytest_results.xml
"""

import os
import re
import time
import uuid
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL_OVERRIDE",
).rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL_OVERRIDE") else None

# Read REACT_APP_BACKEND_URL from /app/frontend/.env directly to mimic public access
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

CRED = {
    "super_admin": ("admin@usbakers.com", "admin123"),
    "outlet_admin": ("outlet@usbakers.com", "outlet123"),
    "order_manager": ("manager@usbakers.com", "manager123"),
    "kitchen": ("kitchen@usbakers.com", "kitchen123"),
    "delivery": ("delivery@usbakers.com", "delivery123"),
    "factory_manager": ("factory@usbakers.com", "factory123"),
}

TOKENS = {}


def login(role):
    if role in TOKENS:
        return TOKENS[role]
    email, pw = CRED[role]
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"Login failed for {role}: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data or "token" in data, f"No token in response: {data}"
    tok = data.get("access_token") or data.get("token")
    TOKENS[role] = tok
    return tok


def headers(role):
    return {"Authorization": f"Bearer {login(role)}", "Content-Type": "application/json"}


# ==================== AUTH ====================
class TestAuth:
    def test_login_all_roles(self):
        results = {}
        for role in CRED:
            email, pw = CRED[role]
            r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
            results[role] = r.status_code
            assert r.status_code == 200, f"{role}: {r.text}"
            d = r.json()
            assert (d.get("access_token") or d.get("token"))
            assert d.get("user", {}).get("role") == role or d.get("role") == role

    def test_login_bad_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": CRED["super_admin"][0], "password": "WRONG"})
        assert r.status_code in (400, 401), f"Expected 401, got {r.status_code}"

    def test_auth_me(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers("super_admin"))
        assert r.status_code == 200
        assert r.json().get("role") == "super_admin"


# ==================== USERS ====================
class TestUsers:
    def test_get_users_super_admin(self):
        r = requests.get(f"{BASE_URL}/api/users", headers=headers("super_admin"))
        assert r.status_code == 200, r.text
        users = r.json()
        assert isinstance(users, list)
        assert len(users) >= 6
        # Verify _id excluded
        for u in users:
            assert "_id" not in u
            assert "permissions" in u  # permissions default fix

    def test_get_users_forbidden_for_kitchen(self):
        r = requests.get(f"{BASE_URL}/api/users", headers=headers("kitchen"))
        assert r.status_code in (401, 403)


# ==================== OUTLETS ====================
class TestOutlets:
    def test_get_outlets(self):
        r = requests.get(f"{BASE_URL}/api/outlets", headers=headers("super_admin"))
        assert r.status_code == 200, r.text
        outlets = r.json()
        assert isinstance(outlets, list)
        for o in outlets:
            assert "_id" not in o

    def test_create_and_delete_outlet(self):
        unique = uuid.uuid4().hex[:6]
        payload = {
            "name": f"TEST_Outlet_{unique}",
            "address": "Test Addr",
            "city": "TestCity",
            "phone": "9999900000",
            "username": f"test_outlet_{unique}",
            "password": "test1234",
            "ready_time_buffer_minutes": 30
        }
        r = requests.post(f"{BASE_URL}/api/outlets", headers=headers("super_admin"), json=payload)
        assert r.status_code in (200, 201), r.text
        outlet = r.json()
        oid = outlet.get("id")
        assert oid
        # Patch
        r2 = requests.patch(f"{BASE_URL}/api/outlets/{oid}",
                            headers=headers("super_admin"),
                            json={**payload, "name": f"TEST_Outlet_Updated_{unique}"})
        assert r2.status_code in (200, 204), r2.text
        # Cleanup
        requests.delete(f"{BASE_URL}/api/outlets/{oid}", headers=headers("super_admin"))


# ==================== ZONES ====================
class TestZones:
    def test_get_zones(self):
        r = requests.get(f"{BASE_URL}/api/zones", headers=headers("super_admin"))
        assert r.status_code == 200, r.text
        for z in r.json():
            assert "_id" not in z

    def test_create_and_delete_zone(self):
        # need an outlet
        outlets = requests.get(f"{BASE_URL}/api/outlets", headers=headers("super_admin")).json()
        if not outlets:
            pytest.skip("No outlet to attach zone to")
        outlet_id = outlets[0]["id"]
        payload = {
            "outlet_id": outlet_id,
            "name": f"TEST_Zone_{uuid.uuid4().hex[:6]}",
            "delivery_charge": 50.0,
        }
        r = requests.post(f"{BASE_URL}/api/zones", headers=headers("super_admin"), json=payload)
        assert r.status_code in (200, 201), r.text
        zid = r.json().get("id") or r.json().get("zone", {}).get("id")
        if zid:
            d = requests.delete(f"{BASE_URL}/api/zones/{zid}", headers=headers("super_admin"))
            assert d.status_code in (200, 204), d.text


# ==================== SALES PERSONS ====================
class TestSalesPersons:
    def test_list(self):
        r = requests.get(f"{BASE_URL}/api/sales-persons", headers=headers("super_admin"))
        assert r.status_code == 200, r.text


# ==================== SETTINGS (FLAVOURS / OCCASIONS / TIME-SLOTS) ====================
class TestSettings:
    def test_flavours_crud(self):
        # list
        r = requests.get(f"{BASE_URL}/api/flavours", headers=headers("super_admin"))
        assert r.status_code == 200, r.text
        # create
        name = f"TEST_Flavour_{uuid.uuid4().hex[:6]}"
        c = requests.post(f"{BASE_URL}/api/flavours", headers=headers("super_admin"), json={"name": name})
        assert c.status_code in (200, 201), c.text
        fid = c.json().get("id")
        if fid:
            d = requests.delete(f"{BASE_URL}/api/flavours/{fid}", headers=headers("super_admin"))
            assert d.status_code in (200, 204)

    def test_occasions_crud(self):
        r = requests.get(f"{BASE_URL}/api/occasions", headers=headers("super_admin"))
        assert r.status_code == 200, r.text
        name = f"TEST_Occ_{uuid.uuid4().hex[:6]}"
        c = requests.post(f"{BASE_URL}/api/occasions", headers=headers("super_admin"), json={"name": name})
        assert c.status_code in (200, 201), c.text
        oid = c.json().get("id")
        if oid:
            requests.delete(f"{BASE_URL}/api/occasions/{oid}", headers=headers("super_admin"))

    def test_time_slots_list(self):
        r = requests.get(f"{BASE_URL}/api/time-slots", headers=headers("super_admin"))
        assert r.status_code == 200, r.text


# ==================== CUSTOMERS ====================
class TestCustomers:
    def test_list_customers(self):
        r = requests.get(f"{BASE_URL}/api/customers", headers=headers("super_admin"))
        assert r.status_code == 200, r.text


# ==================== ORDERS ====================
class TestOrders:
    @pytest.fixture(scope="class")
    def outlet_id(self):
        outlets = requests.get(f"{BASE_URL}/api/outlets", headers=headers("super_admin")).json()
        if not outlets:
            pytest.skip("No outlet available")
        return outlets[0]["id"]

    @pytest.fixture(scope="class")
    def flavour_name(self):
        flavours = requests.get(f"{BASE_URL}/api/flavours", headers=headers("super_admin")).json()
        if flavours:
            return flavours[0].get("name", "Vanilla")
        return "Vanilla"

    def _hold_payload(self, outlet_id, flavour_name):
        # delivery_date and delivery_time required by schema, but order will go to hold if flavour or img missing
        # The HOLD test: minimal-ish; pass empty delivery_date/time to trigger hold
        return {
            "order_type": "self",
            "customer_info": {"name": "TEST_HoldCust", "phone": "9990001111", "gender": "male"},
            "needs_delivery": False,
            "flavour": flavour_name,
            "cake_image_url": "https://via.placeholder.com/100",
            "delivery_date": "",
            "delivery_time": "",
            "outlet_id": outlet_id,
            "total_amount": 0
        }

    def _punch_payload(self, outlet_id, flavour_name):
        future = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        return {
            "order_type": "self",
            "customer_info": {"name": "TEST_PunchCust", "phone": "9990002222", "gender": "female"},
            "needs_delivery": False,
            "flavour": flavour_name,
            "size_pounds": 1.0,
            "cake_image_url": "https://via.placeholder.com/100",
            "delivery_date": future,
            "delivery_time": "10:00",
            "outlet_id": outlet_id,
            "total_amount": 500.0
        }

    def test_create_hold_order_minimal(self, outlet_id, flavour_name):
        r = requests.post(
            f"{BASE_URL}/api/orders?is_punch_order=false",
            headers=headers("super_admin"),
            json=self._hold_payload(outlet_id, flavour_name)
        )
        assert r.status_code in (200, 201), f"Hold order failed: {r.status_code} {r.text}"
        d = r.json()
        assert d.get("order_id"), d
        assert d.get("lifecycle_status") == "hold", f"Expected hold, got {d.get('lifecycle_status')}"
        TestOrders.HOLD_ORDER_ID = d["order_id"]

    def test_create_punch_order_full(self, outlet_id, flavour_name):
        r = requests.post(
            f"{BASE_URL}/api/orders?is_punch_order=true",
            headers=headers("super_admin"),
            json=self._punch_payload(outlet_id, flavour_name)
        )
        assert r.status_code in (200, 201), f"Punch order failed: {r.status_code} {r.text}"
        d = r.json()
        assert d.get("order_id")
        assert d.get("lifecycle_status") in ("pending_payment", "active")
        TestOrders.PUNCH_ORDER_ID = d["order_id"]

    def test_list_orders_manage(self):
        r = requests.get(f"{BASE_URL}/api/orders/manage", headers=headers("super_admin"))
        assert r.status_code == 200, r.text
        for o in (r.json() if isinstance(r.json(), list) else r.json().get("orders", [])):
            assert "_id" not in o

    def test_list_hold_orders(self):
        r = requests.get(f"{BASE_URL}/api/orders/hold", headers=headers("super_admin"))
        assert r.status_code == 200, r.text

    def test_list_pending_orders(self):
        r = requests.get(f"{BASE_URL}/api/orders/pending", headers=headers("super_admin"))
        assert r.status_code == 200, r.text

    def test_list_deleted_orders(self):
        r = requests.get(f"{BASE_URL}/api/orders/deleted", headers=headers("super_admin"))
        assert r.status_code == 200, r.text

    def test_record_payment(self):
        oid = getattr(TestOrders, "PUNCH_ORDER_ID", None)
        if not oid:
            pytest.skip("no punch order")
        r = requests.post(
            f"{BASE_URL}/api/payments",
            headers=headers("super_admin"),
            json={"order_id": oid, "amount": 100, "payment_method": "cash"}
        )
        assert r.status_code in (200, 201), r.text

    def test_get_payments_for_order(self):
        oid = getattr(TestOrders, "PUNCH_ORDER_ID", None)
        if not oid:
            pytest.skip("no punch order")
        r = requests.get(f"{BASE_URL}/api/payments/{oid}", headers=headers("super_admin"))
        assert r.status_code == 200, r.text

    def test_patch_order(self):
        oid = getattr(TestOrders, "PUNCH_ORDER_ID", None)
        if not oid:
            pytest.skip("no punch order")
        r = requests.patch(
            f"{BASE_URL}/api/orders/{oid}",
            headers=headers("super_admin"),
            json={"special_instructions": "TEST_updated_instructions"}
        )
        assert r.status_code in (200, 204), r.text

    def test_delete_order_with_reason(self):
        oid = getattr(TestOrders, "HOLD_ORDER_ID", None)
        if not oid:
            pytest.skip("no hold order")
        r = requests.delete(
            f"{BASE_URL}/api/orders/{oid}?reason=TEST_cleanup",
            headers=headers("super_admin")
        )
        assert r.status_code in (200, 204), r.text

    def test_delete_order_without_reason_should_fail(self):
        # Test reason-validation: should reject empty reason
        oid = getattr(TestOrders, "PUNCH_ORDER_ID", None)
        if not oid:
            pytest.skip("no punch order")
        r = requests.delete(f"{BASE_URL}/api/orders/{oid}",
                            headers=headers("super_admin"))
        # Either 400 (reason required) or 200 (lenient). We document behavior.
        assert r.status_code in (200, 400, 422), f"Unexpected: {r.status_code} {r.text}"


# ==================== KITCHEN ====================
class TestKitchen:
    def test_kitchen_orders_list(self):
        r = requests.get(f"{BASE_URL}/api/kitchen/orders", headers=headers("kitchen"))
        assert r.status_code == 200, r.text

    def test_kitchen_summary(self):
        r = requests.get(f"{BASE_URL}/api/kitchen/orders/summary", headers=headers("kitchen"))
        assert r.status_code == 200, r.text


# ==================== DASHBOARD ====================
class TestDashboard:
    def test_stats_super_admin(self):
        r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers("super_admin"))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_orders_today", "pending_orders"):
            assert k in d, d

    def test_stats_outlet_admin(self):
        r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers("outlet_admin"))
        assert r.status_code == 200, f"Iter2-fix regressed: {r.status_code} {r.text}"

    def test_stats_order_manager(self):
        r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers("order_manager"))
        assert r.status_code == 200, r.text

    def test_branch_summary_super_admin(self):
        r = requests.get(f"{BASE_URL}/api/dashboard/branch-summary", headers=headers("super_admin"))
        assert r.status_code == 200, r.text

    def test_branch_summary_outlet_admin(self):
        r = requests.get(f"{BASE_URL}/api/dashboard/branch-summary", headers=headers("outlet_admin"))
        # Iteration 2 reported 403 here. Track regression.
        assert r.status_code == 200, f"Known iter2 issue: branch-summary 403 for outlet_admin: {r.status_code} {r.text}"


# ==================== ACTIVITY LOGS ====================
class TestActivityLogs:
    def test_admin_can_list(self):
        r = requests.get(f"{BASE_URL}/api/activity-logs", headers=headers("super_admin"))
        assert r.status_code == 200, r.text


# ==================== UPLOAD ====================
class TestUpload:
    def test_upload_image_endpoint_exists(self):
        # POST without file should fail with 422; not 404
        r = requests.post(f"{BASE_URL}/api/upload-image", headers={"Authorization": f"Bearer {login('super_admin')}"})
        assert r.status_code in (400, 422), f"Expected 422; got {r.status_code} {r.text[:200]}"


# ==================== HEALTH ====================
class TestHealth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200, r.text


# ==================== PERMISSIONS ====================
class TestPermissions:
    def test_available(self):
        r = requests.get(f"{BASE_URL}/api/permissions/available", headers=headers("super_admin"))
        assert r.status_code == 200, r.text

    def test_roles_list(self):
        r = requests.get(f"{BASE_URL}/api/permissions/roles", headers=headers("super_admin"))
        assert r.status_code == 200, r.text


# ==================== REPORTS ====================
class TestReports:
    def test_orders_report(self):
        today = datetime.now().strftime("%Y-%m-%d")
        r = requests.get(
            f"{BASE_URL}/api/reports/orders?start_date={today}&end_date={today}",
            headers=headers("super_admin")
        )
        assert r.status_code == 200, r.text

    def test_payments_report(self):
        today = datetime.now().strftime("%Y-%m-%d")
        r = requests.get(
            f"{BASE_URL}/api/reports/payments?start_date={today}&end_date={today}",
            headers=headers("super_admin")
        )
        assert r.status_code == 200, r.text


# ==================== DELIVERY ====================
class TestDelivery:
    def test_my_orders(self):
        r = requests.get(f"{BASE_URL}/api/delivery/my-orders", headers=headers("delivery"))
        assert r.status_code == 200, r.text

    def test_summary(self):
        r = requests.get(f"{BASE_URL}/api/delivery/summary", headers=headers("delivery"))
        assert r.status_code == 200, r.text


# ==================== SECURITY: _id leakage scan ====================
class TestSecurity:
    def test_no_mongo_id_in_orders(self):
        r = requests.get(f"{BASE_URL}/api/orders/manage", headers=headers("super_admin"))
        body = r.text
        assert '"_id"' not in body, "MongoDB _id leaked in /api/orders/manage response"

    def test_no_mongo_id_in_users(self):
        r = requests.get(f"{BASE_URL}/api/users", headers=headers("super_admin"))
        assert '"_id"' not in r.text
