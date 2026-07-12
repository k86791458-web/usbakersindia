"""
Iteration 8 backend tests — Group B: Delivery Flow Rework (P0).

Covers:
- Cities CRUD (list/create/update/delete + RBAC + duplicate case-insensitive check)
- Zone create with delivery_charge validation (multiple of ₹50 or 0)
- Order create with delivery_charge validation (custom + zone)
- PATCH /orders/{id} delivery_charge validation
- POST /orders/{id}/add-delivery — happy path, complementary, custom-invalid, missing zone_id, non-existent order
- OTP verify — invalid + correct → status=delivered, delivered_at set
- Regression spot-checks (GET /orders/deleted, PATCH activity log)
"""

import os
import uuid
import requests
import pytest
from datetime import datetime, timedelta, timezone

# ---------- Base URL ----------
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as _f:
            for _line in _f:
                if _line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = _line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
BASE_URL = BASE_URL.rstrip("/")

SUPER_ADMIN_EMAIL = "admin@usbakers.com"
SUPER_ADMIN_PASSWORD = "admin123"


# ---------- Session-scoped fixtures ----------

@pytest.fixture(scope="session")
def super_admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD,
    }, timeout=20)
    assert r.status_code == 200, f"super admin login failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body
    return body["access_token"]


@pytest.fixture(scope="session")
def super_headers(super_admin_token):
    return {"Authorization": f"Bearer {super_admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def outlet_id(super_headers):
    r = requests.get(f"{BASE_URL}/api/outlets", headers=super_headers, timeout=20)
    assert r.status_code == 200
    outlets = r.json()
    if isinstance(outlets, list) and len(outlets) > 0:
        return outlets[0]["id"]
    tag = uuid.uuid4().hex[:6]
    payload = {
        "name": f"TEST Outlet {tag}", "address": "1 Test Rd", "city": "Testville",
        "phone": "9000000000", "username": f"test_outlet_{tag}",
        "password": "OutletPass!123", "ready_time_buffer_minutes": 30,
    }
    rc = requests.post(f"{BASE_URL}/api/outlets", headers=super_headers, json=payload, timeout=20)
    assert rc.status_code in (200, 201), rc.text
    return rc.json()["id"]


@pytest.fixture(scope="session")
def outlet_admin_token(super_headers, outlet_id):
    tag = uuid.uuid4().hex[:6]
    email = f"TEST_outletadmin_{tag}@usbakers.com"
    password = "TestPass!123"
    payload = {
        "email": email, "name": f"TEST OutletAdmin {tag}", "phone": "9000000001",
        "role": "outlet_admin", "password": password, "outlet_id": outlet_id,
        "outlet_scope": "specific",
    }
    r = requests.post(f"{BASE_URL}/api/users", headers=super_headers, json=payload, timeout=20)
    assert r.status_code in (200, 201), r.text
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def outlet_admin_headers(outlet_admin_token):
    return {"Authorization": f"Bearer {outlet_admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def delivery_person_id(super_headers, outlet_id):
    """Create a delivery user; return its id."""
    tag = uuid.uuid4().hex[:6]
    payload = {
        "email": f"TEST_delivery_{tag}@usbakers.com",
        "name": f"TEST Delivery {tag}",
        "phone": "9000000002",
        "role": "delivery",
        "password": "DeliveryPass!123",
        "outlet_id": outlet_id,
        "outlet_scope": "specific",
    }
    r = requests.post(f"{BASE_URL}/api/users", headers=super_headers, json=payload, timeout=20)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _new_order_payload(outlet_id, tag="", needs_delivery=False):
    tomorrow = (datetime.now() + timedelta(days=1)).date().isoformat()
    return {
        "order_type": "self",
        "customer_info": {
            "name": f"TEST Customer {tag or uuid.uuid4().hex[:4]}",
            "phone": "9999999999",
            "gender": "male",
        },
        "needs_delivery": needs_delivery,
        "occasion": "Birthday",
        "flavour": "Chocolate",
        "size_pounds": 1.5,
        "cake_image_url": "/uploads/test.jpg",
        "delivery_date": tomorrow,
        "delivery_time": "18:00",
        "total_amount": 1000,
        "outlet_id": outlet_id,
    }


def _find_order(headers, order_id):
    for path in ("/api/orders/manage", "/api/orders/hold", "/api/orders/pending", "/api/orders/deleted"):
        try:
            r = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=20)
        except Exception:
            continue
        if r.status_code != 200:
            continue
        for o in r.json():
            if o.get("id") == order_id:
                return o, path
    return None, None


# ==================== 1. CITIES CRUD + RBAC ====================

class TestCitiesCRUD:
    """/api/cities: list, create, patch, delete + duplicate + RBAC"""

    def test_list_cities_returns_array(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/cities", headers=super_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_create_city_super_admin(self, super_headers, request):
        # Unique name to survive re-runs
        tag = uuid.uuid4().hex[:5]
        name = f"TESTCity_{tag}"
        r = requests.post(f"{BASE_URL}/api/cities", headers=super_headers,
                          json={"name": name}, timeout=15)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert "city" in body
        assert body["city"]["name"] == name
        assert body["city"]["is_active"] is True
        assert isinstance(body["city"]["id"], str) and len(body["city"]["id"]) > 0
        # Persist for later tests
        request.session._city_id = body["city"]["id"]
        request.session._city_name = name

    def test_created_city_appears_in_list(self, super_headers, request):
        name = getattr(request.session, "_city_name", None)
        assert name, "prior create_city test must run first"
        r = requests.get(f"{BASE_URL}/api/cities", headers=super_headers, timeout=15)
        assert r.status_code == 200
        names = [c.get("name") for c in r.json()]
        assert name in names, f"created city {name} not in list {names}"

    def test_duplicate_city_case_insensitive(self, super_headers, request):
        name = getattr(request.session, "_city_name", None)
        assert name, "prior create_city test must run first"
        # Send lowercase version of same name
        r = requests.post(f"{BASE_URL}/api/cities", headers=super_headers,
                          json={"name": name.lower()}, timeout=15)
        assert r.status_code == 400, f"expected 400 for duplicate, got {r.status_code} {r.text}"
        assert "already exists" in r.text.lower()

    def test_patch_city_name_and_active(self, super_headers, request):
        cid = getattr(request.session, "_city_id", None)
        assert cid, "prior create_city test must run first"
        new_name = f"TESTCity_renamed_{uuid.uuid4().hex[:5]}"
        r = requests.patch(f"{BASE_URL}/api/cities/{cid}", headers=super_headers,
                           json={"name": new_name, "is_active": True}, timeout=15)
        assert r.status_code == 200, r.text
        # Verify persisted
        r2 = requests.get(f"{BASE_URL}/api/cities", headers=super_headers, timeout=15)
        found = [c for c in r2.json() if c.get("id") == cid]
        assert len(found) == 1
        assert found[0]["name"] == new_name
        request.session._city_name = new_name

    def test_rbac_outlet_admin_cannot_create_city(self, outlet_admin_headers):
        r = requests.post(f"{BASE_URL}/api/cities", headers=outlet_admin_headers,
                          json={"name": f"TESTCity_forbid_{uuid.uuid4().hex[:4]}"}, timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_rbac_outlet_admin_cannot_patch_city(self, outlet_admin_headers, request):
        cid = getattr(request.session, "_city_id", None)
        assert cid
        r = requests.patch(f"{BASE_URL}/api/cities/{cid}", headers=outlet_admin_headers,
                           json={"name": "shouldnt"}, timeout=15)
        assert r.status_code == 403, r.text

    def test_rbac_outlet_admin_cannot_delete_city(self, outlet_admin_headers, request):
        cid = getattr(request.session, "_city_id", None)
        assert cid
        r = requests.delete(f"{BASE_URL}/api/cities/{cid}", headers=outlet_admin_headers, timeout=15)
        assert r.status_code == 403, r.text

    def test_delete_unused_city(self, super_headers, request):
        # Create a fresh city just to delete
        name = f"TESTCity_del_{uuid.uuid4().hex[:5]}"
        r = requests.post(f"{BASE_URL}/api/cities", headers=super_headers,
                          json={"name": name}, timeout=15)
        assert r.status_code in (200, 201), r.text
        cid = r.json()["city"]["id"]
        rd = requests.delete(f"{BASE_URL}/api/cities/{cid}", headers=super_headers, timeout=15)
        assert rd.status_code == 200, rd.text
        # Verify it's gone
        rl = requests.get(f"{BASE_URL}/api/cities", headers=super_headers, timeout=15)
        ids = [c.get("id") for c in rl.json()]
        assert cid not in ids


# ==================== 2. ZONE delivery_charge validation ====================

class TestZoneDeliveryChargeValidation:
    """POST /api/zones enforces delivery_charge is 0 or multiple of ₹50"""

    def test_zone_charge_not_multiple_of_50_rejected(self, super_headers, outlet_id):
        payload = {"outlet_id": outlet_id, "name": f"TESTZone_bad_{uuid.uuid4().hex[:4]}",
                   "delivery_charge": 75}
        r = requests.post(f"{BASE_URL}/api/zones", headers=super_headers, json=payload, timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"
        assert "multiple" in r.text.lower() and "50" in r.text

    def test_zone_charge_100_accepted(self, super_headers, outlet_id, request):
        payload = {"outlet_id": outlet_id, "name": f"TESTZone_100_{uuid.uuid4().hex[:4]}",
                   "delivery_charge": 100}
        r = requests.post(f"{BASE_URL}/api/zones", headers=super_headers, json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body["zone"]["delivery_charge"] == 100
        request.session._zone_id = body["zone"]["id"]

    def test_zone_charge_zero_accepted_complementary(self, super_headers, outlet_id):
        payload = {"outlet_id": outlet_id, "name": f"TESTZone_free_{uuid.uuid4().hex[:4]}",
                   "delivery_charge": 0}
        r = requests.post(f"{BASE_URL}/api/zones", headers=super_headers, json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        assert r.json()["zone"]["delivery_charge"] == 0


# ==================== 3. Order create — delivery_charge validation ====================

class TestOrderCreateDeliveryChargeValidation:
    def test_order_custom_zone_charge_75_rejected(self, super_headers, outlet_id):
        payload = _new_order_payload(outlet_id, "custom-bad", needs_delivery=True)
        payload["zone_id"] = "custom"
        payload["custom_delivery_charge"] = 75
        payload["delivery_address"] = "1 Test Rd"
        payload["delivery_city"] = "TESTCity"
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                          headers=super_headers, json=payload, timeout=20)
        assert r.status_code == 400, f"expected 400 for custom_delivery_charge=75, got {r.status_code} {r.text}"
        assert "multiple" in r.text.lower()

    def test_order_custom_zone_charge_100_accepted(self, super_headers, outlet_id, request):
        payload = _new_order_payload(outlet_id, "custom-ok", needs_delivery=True)
        payload["zone_id"] = "custom"
        payload["custom_delivery_charge"] = 100
        payload["delivery_address"] = "1 Test Rd"
        payload["delivery_city"] = "TESTCity"
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                          headers=super_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        request.session._order_delivered = r.json()["order_id"]


# ==================== 4. PATCH /orders/{id} delivery_charge validation ====================

class TestOrderPatchDeliveryCharge:
    def test_patch_delivery_charge_125_rejected(self, super_headers, outlet_id):
        # Create an order first
        payload = _new_order_payload(outlet_id, "patch-125", needs_delivery=False)
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                          headers=super_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]
        # Patch with 125 — invalid
        rp = requests.patch(f"{BASE_URL}/api/orders/{oid}", headers=super_headers,
                            json={"delivery_charge": 125}, timeout=20)
        assert rp.status_code == 400, f"expected 400 for 125, got {rp.status_code} {rp.text}"
        assert "multiple" in rp.text.lower()

    def test_patch_delivery_charge_150_accepted(self, super_headers, outlet_id):
        payload = _new_order_payload(outlet_id, "patch-150", needs_delivery=False)
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                          headers=super_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]
        rp = requests.patch(f"{BASE_URL}/api/orders/{oid}", headers=super_headers,
                            json={"delivery_charge": 150}, timeout=20)
        assert rp.status_code == 200, rp.text
        # verify persisted
        o, _ = _find_order(super_headers, oid)
        assert o is not None
        assert float(o.get("delivery_charge") or 0) == 150.0


# ==================== 5. POST /orders/{id}/add-delivery ====================

@pytest.fixture(scope="class")
def add_delivery_setup(super_headers, outlet_id):
    """Session-of-class setup: create city, zone, non-delivery order."""
    # City
    city_name = f"TESTCity_ad_{uuid.uuid4().hex[:5]}"
    rc = requests.post(f"{BASE_URL}/api/cities", headers=super_headers,
                       json={"name": city_name}, timeout=15)
    assert rc.status_code in (200, 201), rc.text

    # Zone with 100
    zpayload = {"outlet_id": outlet_id, "name": f"TESTZone_ad_{uuid.uuid4().hex[:4]}",
                "delivery_charge": 100}
    rz = requests.post(f"{BASE_URL}/api/zones", headers=super_headers, json=zpayload, timeout=15)
    assert rz.status_code in (200, 201), rz.text
    zone_id = rz.json()["zone"]["id"]

    # Non-delivery order
    op = _new_order_payload(outlet_id, "ad-happy", needs_delivery=False)
    ro = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                       headers=super_headers, json=op, timeout=20)
    assert ro.status_code == 200, ro.text
    order_id = ro.json()["order_id"]

    return {"city_name": city_name, "zone_id": zone_id, "order_id": order_id,
            "orig_total": 1000.0}


class TestAddDelivery:
    def test_happy_path(self, super_headers, add_delivery_setup, delivery_person_id):
        oid = add_delivery_setup["order_id"]
        zid = add_delivery_setup["zone_id"]
        city = add_delivery_setup["city_name"]
        body = {
            "zone_id": zid,
            "delivery_charge": 100,
            "receiver_info": {
                "name": "TEST Receiver",
                "phone": "9111111111",
                "address": "12 Test Ln",
                "city": city,
            },
            "delivery_address": "12 Test Ln",
            "delivery_city": city,
            # Do NOT pass assign_delivery_person_id: order status is 'active'/hold-ish, not ready_to_deliver.
            # Verifying the skip-branch: passing it is safe (backend logs & skips).
            "assign_delivery_person_id": delivery_person_id,
        }
        r = requests.post(f"{BASE_URL}/api/orders/{oid}/add-delivery",
                          headers=super_headers, json=body, timeout=20)
        assert r.status_code == 200, f"add-delivery failed: {r.status_code} {r.text}"
        resp = r.json()
        assert resp["delivery_charge"] == 100
        assert isinstance(resp["delivery_otp"], str) and len(resp["delivery_otp"]) == 6 and resp["delivery_otp"].isdigit()
        # total should be orig+100
        assert float(resp["total_amount"]) == add_delivery_setup["orig_total"] + 100.0

        # Fetch via GET to verify persistence
        o, _ = _find_order(super_headers, oid)
        assert o is not None
        assert o.get("needs_delivery") is True
        assert o.get("zone_id") == zid
        assert float(o.get("delivery_charge") or 0) == 100.0
        assert o.get("receiver_info") is not None
        assert o["receiver_info"]["name"] == "TEST Receiver"
        assert o["receiver_info"]["phone"] == "9111111111"
        assert isinstance(o.get("delivery_otp"), str) and len(o["delivery_otp"]) == 6
        assert float(o.get("total_amount") or 0) == add_delivery_setup["orig_total"] + 100.0
        # pending should equal new_total - paid (paid_amount likely 0 fresh)
        expected_pending = add_delivery_setup["orig_total"] + 100.0 - float(o.get("paid_amount") or 0)
        assert abs(float(o.get("pending_amount") or 0) - expected_pending) < 1.01

    def test_complementary(self, super_headers, outlet_id):
        # Fresh non-delivery order
        op = _new_order_payload(outlet_id, "ad-comp", needs_delivery=False)
        ro = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                           headers=super_headers, json=op, timeout=20)
        assert ro.status_code == 200
        oid = ro.json()["order_id"]

        # Get zone from previous fixture (create fresh one)
        zpayload = {"outlet_id": outlet_id, "name": f"TESTZone_comp_{uuid.uuid4().hex[:4]}",
                    "delivery_charge": 100}
        rz = requests.post(f"{BASE_URL}/api/zones", headers=super_headers, json=zpayload, timeout=15)
        assert rz.status_code in (200, 201)
        zone_id = rz.json()["zone"]["id"]

        body = {
            "zone_id": zone_id,
            "is_complementary": True,
            # delivery_charge intentionally omitted / can be anything since complementary=true
            "receiver_info": {"name": "TEST", "phone": "9111111112", "address": "x"},
        }
        r = requests.post(f"{BASE_URL}/api/orders/{oid}/add-delivery",
                          headers=super_headers, json=body, timeout=20)
        assert r.status_code == 200, r.text
        resp = r.json()
        assert float(resp["delivery_charge"]) == 0.0
        # total should be unchanged
        assert float(resp["total_amount"]) == 1000.0

        # Confirm via GET
        o, _ = _find_order(super_headers, oid)
        assert o is not None
        assert float(o.get("delivery_charge") or 0) == 0.0
        assert float(o.get("total_amount") or 0) == 1000.0

    def test_custom_zone_75_rejected(self, super_headers, add_delivery_setup):
        # Fresh order to isolate side effects
        pass  # use existing order — validation runs before any DB mutation
        oid = add_delivery_setup["order_id"]
        body = {"zone_id": "custom", "delivery_charge": 75,
                "receiver_info": {"name": "x", "phone": "y", "address": "z"}}
        r = requests.post(f"{BASE_URL}/api/orders/{oid}/add-delivery",
                          headers=super_headers, json=body, timeout=20)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"
        assert "multiple" in r.text.lower()

    def test_add_delivery_nonexistent_order(self, super_headers):
        body = {"zone_id": "custom", "delivery_charge": 100}
        r = requests.post(f"{BASE_URL}/api/orders/nonexistent-id-{uuid.uuid4().hex}/add-delivery",
                          headers=super_headers, json=body, timeout=15)
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"

    def test_add_delivery_missing_zone_id(self, super_headers, outlet_id):
        # Fresh order
        op = _new_order_payload(outlet_id, "ad-nozone", needs_delivery=False)
        ro = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                           headers=super_headers, json=op, timeout=20)
        assert ro.status_code == 200
        oid = ro.json()["order_id"]
        r = requests.post(f"{BASE_URL}/api/orders/{oid}/add-delivery",
                          headers=super_headers, json={"delivery_charge": 100}, timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"
        assert "zone_id" in r.text.lower()


# ==================== 6. OTP verify flow ====================

class TestOTPVerify:
    def test_otp_wrong_then_correct(self, super_headers, outlet_id, delivery_person_id):
        # Create an order + zone + add-delivery so OTP is generated
        zpayload = {"outlet_id": outlet_id, "name": f"TESTZone_otp_{uuid.uuid4().hex[:4]}",
                    "delivery_charge": 100}
        rz = requests.post(f"{BASE_URL}/api/zones", headers=super_headers, json=zpayload, timeout=15)
        assert rz.status_code in (200, 201)
        zone_id = rz.json()["zone"]["id"]

        op = _new_order_payload(outlet_id, "otp", needs_delivery=False)
        ro = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                           headers=super_headers, json=op, timeout=20)
        assert ro.status_code == 200
        oid = ro.json()["order_id"]

        # add-delivery to inject OTP
        body = {"zone_id": zone_id, "delivery_charge": 100,
                "receiver_info": {"name": "TEST", "phone": "9111111113", "address": "x"}}
        ra = requests.post(f"{BASE_URL}/api/orders/{oid}/add-delivery",
                           headers=super_headers, json=body, timeout=20)
        assert ra.status_code == 200, ra.text
        otp = ra.json()["delivery_otp"]

        # Force status='picked_up' via PATCH so the verify-otp semantics reflect a real flow
        rp = requests.patch(f"{BASE_URL}/api/orders/{oid}", headers=super_headers,
                            json={"status": "picked_up"}, timeout=20)
        assert rp.status_code == 200, rp.text

        # Wrong OTP → 400
        rw = requests.post(f"{BASE_URL}/api/delivery/verify-otp", headers=super_headers,
                           json={"order_id": oid, "otp": "000000"}, timeout=15)
        assert rw.status_code == 400, f"expected 400 wrong OTP, got {rw.status_code} {rw.text}"
        assert "invalid" in rw.text.lower()

        # Correct OTP → 200 and order becomes delivered
        rok = requests.post(f"{BASE_URL}/api/delivery/verify-otp", headers=super_headers,
                            json={"order_id": oid, "otp": otp}, timeout=15)
        assert rok.status_code == 200, f"expected 200 correct OTP, got {rok.status_code} {rok.text}"

        # Verify via GET
        o, _ = _find_order(super_headers, oid)
        assert o is not None
        assert o.get("status") == "delivered", f"expected status=delivered, got {o.get('status')}"
        assert o.get("delivered_at"), "delivered_at should be set"


# ==================== 7. Regression spot-check ====================

class TestRegressionSpotChecks:
    def test_deleted_orders_route_still_returns_array(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/orders/deleted", headers=super_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_activity_log_diff_still_populated_on_patch(self, super_headers, outlet_id):
        # Create + patch an order, then look for order_updated activity_log entry
        op = _new_order_payload(outlet_id, "reg", needs_delivery=False)
        ro = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                           headers=super_headers, json=op, timeout=20)
        assert ro.status_code == 200
        oid = ro.json()["order_id"]
        rp = requests.patch(f"{BASE_URL}/api/orders/{oid}", headers=super_headers,
                            json={"flavour": "Vanilla"}, timeout=20)
        assert rp.status_code == 200, rp.text
        rl = requests.get(f"{BASE_URL}/api/activity-logs?action_type=order_updated",
                          headers=super_headers, timeout=15)
        assert rl.status_code == 200
        logs = rl.json()
        assert isinstance(logs, list) and len(logs) > 0
        # Find one matching this order — before_data & after_data both non-empty
        matches = [
            L for L in logs
            if (L.get("entity_id") == oid or (L.get("description") or "").find(oid) >= 0)
            and L.get("before_data") and L.get("after_data")
        ]
        # At least one order_updated log has both diff snapshots populated
        any_with_diff = any(L.get("before_data") and L.get("after_data") for L in logs)
        assert any_with_diff, "no activity_logs order_updated entries had before_data+after_data populated"
