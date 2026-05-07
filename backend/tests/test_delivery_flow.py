"""
Backend tests for the delivery flow:
 - Delivery user login
 - GET /api/delivery/available-orders
 - POST /api/delivery/accept-order/{id}
 - GET /api/delivery/my-orders
 - PATCH /api/orders/{id}/status?status=delivered
 - Negative paths: non-delivery cannot accept; double-accept fails; non-ready order cannot be accepted
 - Manager assignment via POST /api/delivery/assign-order/{id}?delivery_person_id=...
 - Orders list shows assigned_delivery_partner after assignment
"""
import os
import uuid
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://sweet-creations-166.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@usbakers.com", "admin123")
DELIVERY = ("delivery1@usbakers.com", "delivery123")
MANAGER = ("manager@usbakers.com", "manager123")
KITCHEN = ("kitchen@usbakers.com", "kitchen123")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    if r.status_code != 200:
        return None, None
    data = r.json()
    return data["access_token"], data["user"]


@pytest.fixture(scope="session")
def admin():
    tok, user = _login(*ADMIN)
    assert tok, "Super admin login failed"
    return tok, user


@pytest.fixture(scope="session")
def delivery_user():
    tok, user = _login(*DELIVERY)
    if not tok:
        pytest.skip("delivery1 user not seeded")
    return tok, user


@pytest.fixture(scope="session")
def manager():
    tok, user = _login(*MANAGER)
    if not tok:
        pytest.skip("manager user not seeded; run seed_data.py")
    return tok, user


@pytest.fixture(scope="session")
def kitchen():
    tok, user = _login(*KITCHEN)
    if not tok:
        pytest.skip("kitchen user not seeded")
    return tok, user


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def outlet_id(admin):
    tok, _ = admin
    r = requests.get(f"{API}/outlets", headers=_h(tok), timeout=15)
    assert r.status_code == 200
    outlets = r.json()
    assert outlets, "no outlets"
    return outlets[0]["id"]


def _disable_slot_cap(admin_tok):
    requests.patch(
        f"{API}/system-settings",
        headers=_h(admin_tok),
        json={"minimum_payment_percentage": 25.0, "max_orders_per_time_slot": 0},
        timeout=15,
    )


def _make_ready_to_deliver_order(admin_tok, outlet_id, time_str=None):
    """Create an order, mark confirmed -> ready -> ready_to_deliver via status PATCHes."""
    _disable_slot_cap(admin_tok)
    future = (datetime.now() + timedelta(days=15 + (uuid.uuid4().int % 30))).strftime("%Y-%m-%d")
    if time_str is None:
        time_str = f"{(uuid.uuid4().int % 9) + 9:02d}:{(uuid.uuid4().int % 6) * 10:02d}"
    payload = {
        "order_type": "self",
        "customer_info": {"name": "TEST_DEL_Cust", "phone": "9000111222"},
        "needs_delivery": True,
        "delivery_address": "TEST 12 Test Lane, Mumbai",
        "flavour": "Vanilla",
        "size_pounds": 1.0,
        "base_size": 1.0,
        "cake_image_url": "/api/uploads/test.jpg",
        "delivery_date": future,
        "delivery_time": time_str,
        "outlet_id": outlet_id,
        "total_amount": 800.0,
        "advance_paid": 800.0,
    }
    r = requests.post(f"{API}/orders", headers=_h(admin_tok), json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    oid = r.json().get("order_id") or r.json().get("id")
    assert oid

    # confirmed -> ready -> ready_to_deliver
    for st in ("confirmed", "ready", "ready_to_deliver"):
        r2 = requests.patch(
            f"{API}/orders/{oid}/status",
            headers=_h(admin_tok),
            params={"status": st},
            timeout=15,
        )
        assert r2.status_code == 200, f"transition to {st} failed: {r2.status_code} {r2.text}"
    return oid


# ------------- Tests -------------

class TestDeliveryAuth:
    def test_delivery_login(self, delivery_user):
        tok, user = delivery_user
        assert tok and user.get("role") == "delivery"


class TestDeliveryHappyPath:
    def test_full_flow_accept_and_deliver(self, admin, delivery_user, outlet_id):
        admin_tok, _ = admin
        del_tok, del_user = delivery_user

        oid = _make_ready_to_deliver_order(admin_tok, outlet_id)

        # available-orders should include this order
        r = requests.get(f"{API}/delivery/available-orders", headers=_h(del_tok), timeout=15)
        assert r.status_code == 200, r.text
        ids = [o["id"] for o in r.json()]
        assert oid in ids, f"new order {oid} missing from available-orders"

        # accept
        ra = requests.post(f"{API}/delivery/accept-order/{oid}", headers=_h(del_tok), timeout=15)
        assert ra.status_code == 200, ra.text

        # my-orders shows it (status picked_up)
        rm = requests.get(f"{API}/delivery/my-orders", headers=_h(del_tok), timeout=15)
        assert rm.status_code == 200
        my = {o["id"]: o for o in rm.json()}
        assert oid in my
        assert my[oid]["status"] == "picked_up"
        assert my[oid]["assigned_delivery_partner"] == del_user["id"]

        # mark delivered via status PATCH (query param)
        rd = requests.patch(
            f"{API}/orders/{oid}/status",
            headers=_h(del_tok),
            params={"status": "delivered"},
            timeout=15,
        )
        assert rd.status_code == 200, rd.text

        # my-orders still shows it under delivered
        rm2 = requests.get(f"{API}/delivery/my-orders", headers=_h(del_tok), timeout=15)
        assert rm2.status_code == 200
        my2 = {o["id"]: o for o in rm2.json()}
        assert oid in my2
        assert my2[oid]["status"] == "delivered"


class TestDeliveryNegative:
    def test_non_delivery_cannot_accept(self, admin, kitchen, outlet_id):
        admin_tok, _ = admin
        kit_tok, _ = kitchen
        oid = _make_ready_to_deliver_order(admin_tok, outlet_id)
        r = requests.post(f"{API}/delivery/accept-order/{oid}", headers=_h(kit_tok), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_double_accept_fails(self, admin, delivery_user, outlet_id):
        admin_tok, _ = admin
        del_tok, _ = delivery_user
        oid = _make_ready_to_deliver_order(admin_tok, outlet_id)
        r1 = requests.post(f"{API}/delivery/accept-order/{oid}", headers=_h(del_tok), timeout=15)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/delivery/accept-order/{oid}", headers=_h(del_tok), timeout=15)
        # Status moved to picked_up so it should fail with 400 (not ready_to_deliver) or already accepted
        assert r2.status_code == 400, r2.text

    def test_accept_when_not_ready_to_deliver(self, admin, delivery_user, outlet_id):
        """Create an order in confirmed status and try to accept – must fail."""
        admin_tok, _ = admin
        del_tok, _ = delivery_user
        _disable_slot_cap(admin_tok)
        future = (datetime.now() + timedelta(days=20)).strftime("%Y-%m-%d")
        time_str = f"{(uuid.uuid4().int % 9) + 9:02d}:{(uuid.uuid4().int % 6) * 10:02d}"
        payload = {
            "order_type": "self",
            "customer_info": {"name": "TEST_DEL_NotReady", "phone": "9000333444"},
            "needs_delivery": True,
            "delivery_address": "TEST 1 Not Ready",
            "flavour": "Choco",
            "size_pounds": 1.0,
            "base_size": 1.0,
            "cake_image_url": "/api/uploads/test.jpg",
            "delivery_date": future,
            "delivery_time": time_str,
            "outlet_id": outlet_id,
            "total_amount": 500.0,
        }
        r = requests.post(f"{API}/orders", headers=_h(admin_tok), json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        oid = r.json().get("order_id") or r.json().get("id")
        # leave in pending – should still 400 for accept
        ra = requests.post(f"{API}/delivery/accept-order/{oid}", headers=_h(del_tok), timeout=15)
        assert ra.status_code == 400, ra.text


class TestManagerAssign:
    def test_manager_can_assign_and_appears_in_my_orders(self, admin, manager, delivery_user, outlet_id):
        admin_tok, _ = admin
        mgr_tok, _ = manager
        del_tok, del_user = delivery_user

        # Find delivery_person_id via /delivery/persons (manager has access)
        rp = requests.get(f"{API}/delivery/persons", headers=_h(mgr_tok), timeout=15)
        assert rp.status_code == 200, rp.text
        persons = rp.json()
        assert any(p["id"] == del_user["id"] for p in persons), "delivery1 not in /delivery/persons"

        oid = _make_ready_to_deliver_order(admin_tok, outlet_id)
        ra = requests.post(
            f"{API}/delivery/assign-order/{oid}",
            headers=_h(mgr_tok),
            params={"delivery_person_id": del_user["id"]},
            timeout=15,
        )
        assert ra.status_code == 200, ra.text

        # my-orders for delivery user includes it
        rm = requests.get(f"{API}/delivery/my-orders", headers=_h(del_tok), timeout=15)
        assert rm.status_code == 200
        ids = [o["id"] for o in rm.json()]
        assert oid in ids

        # /orders/manage shows assigned_delivery_partner field
        ro = requests.get(f"{API}/orders/manage", headers=_h(admin_tok), timeout=15)
        assert ro.status_code == 200
        match = next((o for o in ro.json() if o["id"] == oid), None)
        assert match is not None, "assigned order not found in /orders/manage"
        assert match.get("assigned_delivery_partner") == del_user["id"]


class TestOrdersListRegression:
    def test_orders_manage_works(self, admin):
        tok, _ = admin
        r = requests.get(f"{API}/orders/manage", headers=_h(tok), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
