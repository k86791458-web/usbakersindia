"""
Iteration 4 — focused tests for the batch of bug fixes:
  Bug #1: delivery_charge added to order total (custom + real zone)
  Bug #2: empty base_size / size_pounds must be coerced to None
  Bug #4: kitchen_ready_deadline parses multiple time formats incl. slot ranges
  Bug #5: activity logs are written for login, order CRUD, payment
  Bug #6: AiSensy config + templates + logs endpoints

Run: pytest /app/backend/tests/test_iteration_4_fixes.py -v --tb=short \
        --junitxml=/app/test_reports/pytest/iteration_4_results.xml
"""
import os
import uuid
import time
import pytest
import requests
from datetime import datetime, timedelta

# Load BASE_URL from /app/frontend/.env
BASE_URL = None
with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN = ("admin@usbakers.com", "admin123")


# ---------- helpers ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    return d.get("access_token") or d.get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def outlet(admin_headers):
    outlets = requests.get(f"{BASE_URL}/api/outlets", headers=admin_headers).json()
    if not outlets:
        pytest.skip("No outlet")
    return outlets[0]


@pytest.fixture(scope="module")
def zone(admin_headers, outlet):
    zones = requests.get(f"{BASE_URL}/api/zones", headers=admin_headers).json()
    for z in zones:
        if z.get("outlet_id") == outlet["id"] and z.get("id"):
            return z
    # create one if none — then re-fetch to get full document (with id)
    payload = {"outlet_id": outlet["id"], "name": f"TEST_Zone_{uuid.uuid4().hex[:6]}", "delivery_charge": 75.0}
    r = requests.post(f"{BASE_URL}/api/zones", headers=admin_headers, json=payload)
    assert r.status_code in (200, 201), r.text
    zones2 = requests.get(f"{BASE_URL}/api/zones", headers=admin_headers).json()
    for z in zones2:
        if z.get("outlet_id") == outlet["id"] and z.get("id"):
            return z
    pytest.skip("Could not obtain a zone with id")


def _get_order_by_id(headers, order_id):
    """No GET /orders/{id} endpoint; search manage + pending + hold."""
    for path in ("/api/orders/pending", "/api/orders/manage", "/api/orders/hold"):
        r = requests.get(f"{BASE_URL}{path}", headers=headers)
        if r.status_code != 200:
            continue
        for o in r.json():
            if o.get("id") == order_id:
                return o
    return None


@pytest.fixture(scope="module")
def flavour(admin_headers):
    fls = requests.get(f"{BASE_URL}/api/flavours", headers=admin_headers).json()
    if fls:
        return fls[0]["name"]
    r = requests.post(f"{BASE_URL}/api/flavours", headers=admin_headers, json={"name": "TEST_Flav"})
    return r.json().get("name", "TEST_Flav")


def _future_date(days=2):
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")


# ==================== Bug #1: delivery_charge in total ====================
class TestBug1DeliveryCharge:
    def test_custom_zone_adds_delivery_to_total(self, admin_headers, outlet, flavour):
        payload = {
            "order_type": "self",
            "customer_info": {"name": "TEST_CustomZone", "phone": "9990010001", "gender": "male"},
            "needs_delivery": True,
            "zone_id": "custom",
            "custom_delivery_charge": 200,
            "delivery_address": "Test Addr",
            "flavour": flavour,
            "size_pounds": 1.0,
            "cake_image_url": "https://via.placeholder.com/100",
            "delivery_date": _future_date(),
            "delivery_time": "14:30",
            "outlet_id": outlet["id"],
            "total_amount": 800,
        }
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=true", headers=admin_headers, json=payload)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        order_id = r.json()["order_id"]
        o = _get_order_by_id(admin_headers, order_id)
        assert o, f"Order {order_id} not found in /orders/manage"
        assert float(o.get("delivery_charge", 0)) == 200.0, f"delivery_charge wrong: {o.get('delivery_charge')}"
        assert float(o.get("total_amount", 0)) == 1000.0, f"total_amount wrong: {o.get('total_amount')} (expected 1000)"

    def test_real_zone_adds_delivery_to_total(self, admin_headers, outlet, zone, flavour):
        zone_charge = float(zone.get("delivery_charge", 0))
        payload = {
            "order_type": "self",
            "customer_info": {"name": "TEST_RealZone", "phone": "9990010002", "gender": "male"},
            "needs_delivery": True,
            "zone_id": zone["id"],
            "delivery_address": "Test Addr",
            "flavour": flavour,
            "size_pounds": 1.0,
            "cake_image_url": "https://via.placeholder.com/100",
            "delivery_date": _future_date(),
            "delivery_time": "14:30",
            "outlet_id": outlet["id"],
            "total_amount": 500,
        }
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=true", headers=admin_headers, json=payload)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        oid = r.json()["order_id"]
        g = _get_order_by_id(admin_headers, oid)
        assert g, "order not in manage list"
        assert float(g.get("delivery_charge", 0)) == zone_charge, f"got {g.get('delivery_charge')} expected {zone_charge}"
        assert float(g.get("total_amount", 0)) == 500 + zone_charge


# ==================== Bug #2: empty base_size ====================
class TestBug2EmptyBaseSize:
    def test_empty_base_size_and_size_pounds_accepted(self, admin_headers, outlet, flavour):
        payload = {
            "order_type": "self",
            "customer_info": {"name": "TEST_EmptyBase", "phone": "9990020001", "gender": "male"},
            "needs_delivery": False,
            "flavour": flavour,
            "base_size": "",       # empty string must be coerced to None
            "size_pounds": "",     # ditto
            "custom_delivery_charge": "",
            "cake_image_url": "https://via.placeholder.com/100",
            "delivery_date": _future_date(),
            "delivery_time": "10:00",
            "outlet_id": outlet["id"],
            "total_amount": 500,
        }
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=true", headers=admin_headers, json=payload)
        # Must not be 422
        assert r.status_code in (200, 201), f"Empty base_size failed: {r.status_code} {r.text}"
        d = r.json()
        assert d.get("order_id")


# ==================== Bug #4: kitchen_ready_deadline parsing ====================
class TestBug4KitchenDeadline:
    @pytest.mark.parametrize("dtime", ["14:30", "14:30:00", "2:30 PM", "10:00 AM - 12:00 PM"])
    def test_deadline_computed_for_various_time_formats(self, admin_headers, outlet, flavour, dtime):
        today = datetime.now().strftime("%Y-%m-%d")
        payload = {
            "order_type": "self",
            "customer_info": {"name": f"TEST_Kit_{uuid.uuid4().hex[:4]}", "phone": "9990040001", "gender": "male"},
            "needs_delivery": False,
            "flavour": flavour,
            "size_pounds": 1.0,
            "cake_image_url": "https://via.placeholder.com/100",
            "delivery_date": today,
            "delivery_time": dtime,
            "outlet_id": outlet["id"],
            "total_amount": 300,
        }
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=true", headers=admin_headers, json=payload)
        assert r.status_code in (200, 201), r.text
        # Fetch kitchen orders (today's) with status=pending since new orders are PENDING
        k = requests.get(f"{BASE_URL}/api/kitchen/orders?status=pending", headers=admin_headers)
        assert k.status_code == 200, k.text
        orders = k.json()
        # Find the just-created one and assert deadline computed
        target = next(
            (o for o in orders if o.get("customer_info", {}).get("phone") == "9990040001"
             and o.get("delivery_time") == dtime),
            None
        )
        assert target, f"Could not find order with time {dtime}"
        assert target.get("kitchen_ready_deadline"), f"No kitchen_ready_deadline for time '{dtime}': {target.get('kitchen_ready_deadline')}"


# ==================== Bug #5: activity logs writing ====================
class TestBug5ActivityLogs:
    def test_activity_logs_endpoint_returns_entries(self, admin_headers):
        # Trigger a login first to ensure a fresh login entry
        requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]})
        time.sleep(0.5)
        r = requests.get(f"{BASE_URL}/api/activity-logs", headers=admin_headers)
        assert r.status_code == 200, r.text
        logs = r.json()
        assert isinstance(logs, list)
        assert len(logs) > 0, "Activity logs is empty — no endpoint writing to it"
        # _id must not leak
        for log in logs[:20]:
            assert "_id" not in log
        # Look for expected action_types
        action_types = {log.get("action_type") for log in logs}
        # At least login should be there
        assert "login" in action_types, f"No 'login' action type in logs. Found: {action_types}"

    def test_order_created_log_present(self, admin_headers, outlet, flavour):
        # Create an order then verify order_created log appears
        payload = {
            "order_type": "self",
            "customer_info": {"name": "TEST_LogOrder", "phone": "9990050001", "gender": "male"},
            "needs_delivery": False,
            "flavour": flavour,
            "size_pounds": 1.0,
            "cake_image_url": "https://via.placeholder.com/100",
            "delivery_date": _future_date(),
            "delivery_time": "10:00",
            "outlet_id": outlet["id"],
            "total_amount": 400,
        }
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=true", headers=admin_headers, json=payload)
        assert r.status_code in (200, 201), r.text
        time.sleep(0.5)
        logs = requests.get(f"{BASE_URL}/api/activity-logs?limit=100", headers=admin_headers).json()
        action_types = {log.get("action_type") for log in logs}
        assert "order_created" in action_types, f"order_created not in logs: {action_types}"

    def test_activity_logs_forbidden_for_non_admin(self):
        # Try with kitchen credentials
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "kitchen@usbakers.com", "password": "kitchen123"})
        if r.status_code != 200:
            pytest.skip("kitchen creds not available")
        tok = r.json().get("access_token") or r.json().get("token")
        h = {"Authorization": f"Bearer {tok}"}
        rr = requests.get(f"{BASE_URL}/api/activity-logs", headers=h)
        assert rr.status_code in (401, 403), f"Expected 403; got {rr.status_code}"


# ==================== Bug #6: AiSensy endpoints ====================
class TestBug6AiSensy:
    def test_get_config_returns_required_fields(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/aisensy/config", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("api_key_masked", "is_active", "configured", "default_source", "default_user_name"):
            assert k in d, f"Missing key {k}"
        # Plaintext api_key must not be returned
        assert d.get("api_key", "") == ""

    def test_post_config_saves(self, admin_headers):
        new_key = "TEST_KEY_" + uuid.uuid4().hex
        r = requests.post(
            f"{BASE_URL}/api/aisensy/config",
            headers=admin_headers,
            json={"api_key": new_key, "default_source": "crm", "default_user_name": "US Bakers"},
        )
        assert r.status_code in (200, 201), r.text
        # Verify masked api_key in GET reflects last 6
        g = requests.get(f"{BASE_URL}/api/aisensy/config", headers=admin_headers).json()
        assert g.get("configured") is True
        assert new_key[-6:] in g.get("api_key_masked", ""), f"masked key mismatch: {g.get('api_key_masked')}"

    def test_get_templates(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/aisensy/templates", headers=admin_headers)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_post_template(self, admin_headers):
        payload = {
            "event_type": "order_placed",
            "campaign_name": "TEST_OrderPlaced_Camp",
            "template_params": ["customer_name", "order_number", "delivery_date", "delivery_time"],
            "tags": ["test"],
            "is_enabled": True,
        }
        r = requests.post(f"{BASE_URL}/api/aisensy/templates", headers=admin_headers, json=payload)
        assert r.status_code in (200, 201), r.text
        # Verify list contains it
        ts = requests.get(f"{BASE_URL}/api/aisensy/templates", headers=admin_headers).json()
        names = [t.get("campaign_name") for t in ts]
        assert "TEST_OrderPlaced_Camp" in names

    def test_aisensy_logs_endpoint(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/aisensy/logs", headers=admin_headers)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_aisensy_config_forbidden_non_admin(self):
        # outlet_admin shouldn't access
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "outlet@usbakers.com", "password": "outlet123"})
        if r.status_code != 200:
            pytest.skip("outlet creds missing")
        tok = r.json().get("access_token") or r.json().get("token")
        h = {"Authorization": f"Bearer {tok}"}
        rr = requests.get(f"{BASE_URL}/api/aisensy/config", headers=h)
        assert rr.status_code in (401, 403)


# ==================== Smart-TV noscript ====================
class TestSmartTV:
    def test_tv_kitchen_html_exists(self):
        r = requests.get(f"{BASE_URL}/tv-kitchen.html", timeout=15)
        assert r.status_code == 200, f"tv-kitchen.html missing: {r.status_code}"
        assert "kitchen" in r.text.lower() or "waiting" in r.text.lower()

    def test_index_noscript_links_tv_kitchen(self):
        r = requests.get(f"{BASE_URL}/", timeout=15)
        assert r.status_code == 200
        body = r.text
        assert "noscript" in body.lower()
        assert "tv-kitchen.html" in body, "index.html noscript block must link to /tv-kitchen.html"

    def test_index_has_tv_ua_redirect_script(self):
        r = requests.get(f"{BASE_URL}/", timeout=15).text
        # Check for UA-detection markers
        markers = ["Tizen", "WebOS", "tv-kitchen.html"]
        assert any(m in r for m in markers), "No Smart-TV UA-redirect markers found in index.html"
