"""
Iteration 6 backend tests — Group A: Order Lifecycle & Editing.

Covers:
- Super admin login → token
- Outlet fetch
- Create order (POST /api/orders)
- PATCH /api/orders/{id} with the 13 newly-added allowed_fields
- Field persistence via GET /api/orders/manage
- pending_amount recalc + normalize_pending on total_amount update
- Super Admin bypass of is_ready lock
- Non-super-admin blocked with 400 after is_ready
- Activity log persistence (order_updated with before_data/after_data)
- WhatsApp background task tolerates missing AiSensy config
- secondary_images list persistence
- DELETE by super_admin → deleted_from_status / deleted_from_lifecycle_status
- DELETE by non-super → pending → approve-delete → same fields present
- GET /api/orders/deleted returns array (route not shadowed)
"""

import os
import time
import uuid
import requests
import pytest
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback to frontend .env directly
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


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def super_admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD,
    }, timeout=20)
    assert r.status_code == 200, f"super admin login failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("requires_2fa") is False, "2FA is unexpectedly enabled on super admin"
    assert "access_token" in body
    return body["access_token"]


@pytest.fixture(scope="session")
def super_headers(super_admin_token):
    return {"Authorization": f"Bearer {super_admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def outlet_id(super_headers):
    r = requests.get(f"{BASE_URL}/api/outlets", headers=super_headers, timeout=20)
    assert r.status_code == 200, f"/api/outlets failed: {r.status_code} {r.text}"
    outlets = r.json()
    if isinstance(outlets, list) and len(outlets) > 0:
        return outlets[0]["id"]
    # Seed an outlet if none exists — required by all order-related tests
    tag = uuid.uuid4().hex[:6]
    payload = {
        "name": f"TEST Outlet {tag}",
        "address": "1 Test Rd",
        "city": "Testville",
        "phone": "9000000000",
        "username": f"test_outlet_{tag}",
        "password": "OutletPass!123",
        "ready_time_buffer_minutes": 30,
    }
    rc = requests.post(f"{BASE_URL}/api/outlets", headers=super_headers, json=payload, timeout=20)
    assert rc.status_code in (200, 201), f"seed outlet failed: {rc.status_code} {rc.text}"
    return rc.json()["id"]


@pytest.fixture(scope="session")
def outlet_admin_token(super_headers, outlet_id):
    """Create (idempotent) an outlet_admin user and log in as that user, return token."""
    tag = uuid.uuid4().hex[:6]
    email = f"TEST_outletadmin_{tag}@usbakers.com"
    password = "TestPass!123"
    payload = {
        "email": email,
        "name": f"TEST OutletAdmin {tag}",
        "phone": "9000000001",
        "role": "outlet_admin",
        "password": password,
        "outlet_id": outlet_id,
        "outlet_scope": "specific",
    }
    r = requests.post(f"{BASE_URL}/api/users", headers=super_headers, json=payload, timeout=20)
    assert r.status_code in (200, 201), f"create outlet_admin failed: {r.status_code} {r.text}"

    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"outlet_admin login failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body
    return body["access_token"]


@pytest.fixture(scope="session")
def outlet_admin_headers(outlet_admin_token):
    return {"Authorization": f"Bearer {outlet_admin_token}", "Content-Type": "application/json"}


def _new_order_payload(outlet_id, tag=""):
    tomorrow = (datetime.now() + timedelta(days=1)).date().isoformat()
    return {
        "order_type": "self",
        "customer_info": {
            "name": f"TEST Customer {tag or uuid.uuid4().hex[:4]}",
            "phone": "9999999999",
            "gender": "male",
        },
        "needs_delivery": False,
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
    """Look up an order across manage/hold/pending/deleted."""
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


# ---------- 1. Login + outlets ----------

class TestAuthAndOutlets:
    def test_super_admin_login(self, super_admin_token):
        assert isinstance(super_admin_token, str) and len(super_admin_token) > 20

    def test_outlets_available(self, outlet_id):
        assert isinstance(outlet_id, str) and len(outlet_id) > 0


# ---------- 2. Create HOLD order ----------

class TestOrderCreation:
    def test_create_full_hold_order(self, super_headers, outlet_id, request):
        payload = _new_order_payload(outlet_id, "create")
        r = requests.post(
            f"{BASE_URL}/api/orders?is_punch_order=false",
            headers=super_headers, json=payload, timeout=20,
        )
        assert r.status_code == 200, f"create order failed: {r.status_code} {r.text}"
        order = r.json()
        # Response shape: {"message", "order_id", "order_number", "lifecycle_status", ...}
        assert "order_id" in order, f"missing order_id in {order}"
        oid = order["order_id"]
        # Verify via GET
        o, _ = _find_order(super_headers, oid)
        assert o is not None, "created order not found via GET"
        assert o["customer_info"]["phone"] == "9999999999"
        assert float(o["total_amount"]) == 1000.0
        request.session._primary_order_id = oid
        request.session._primary_order = o


# ---------- 3. PATCH all 13 new allowed_fields ----------

@pytest.fixture(scope="session")
def primary_order_id(super_headers, outlet_id):
    payload = _new_order_payload(outlet_id, "primary")
    r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                      headers=super_headers, json=payload, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["order_id"]


class TestPatchNewAllowedFields:
    """PATCH each of the 13 newly-added allowed_fields."""

    def test_patch_receiver_info(self, super_headers, primary_order_id):
        body = {"receiver_info": {"name": "Recv A", "phone": "9111111111", "address": "Addr"}}
        r = requests.patch(f"{BASE_URL}/api/orders/{primary_order_id}",
                           headers=super_headers, json=body, timeout=20)
        assert r.status_code == 200, r.text
        assert "receiver_info" in (r.json().get("changed_fields") or [])
        o, _ = _find_order(super_headers, primary_order_id)
        assert o and o.get("receiver_info", {}).get("name") == "Recv A"

    def test_patch_delivery_address_and_city(self, super_headers, primary_order_id):
        body = {"delivery_address": "12 Test St", "delivery_city": "Testville"}
        r = requests.patch(f"{BASE_URL}/api/orders/{primary_order_id}",
                           headers=super_headers, json=body, timeout=20)
        assert r.status_code == 200, r.text
        cf = r.json().get("changed_fields") or []
        assert "delivery_address" in cf and "delivery_city" in cf
        o, _ = _find_order(super_headers, primary_order_id)
        assert o and o.get("delivery_address") == "12 Test St"
        assert o.get("delivery_city") == "Testville"

    def test_patch_zone_id_and_needs_delivery_and_charges(self, super_headers, primary_order_id):
        body = {
            "zone_id": "custom",
            "needs_delivery": True,
            "delivery_charge": 50.0,
            "custom_delivery_charge": 75.0,
        }
        r = requests.patch(f"{BASE_URL}/api/orders/{primary_order_id}",
                           headers=super_headers, json=body, timeout=20)
        assert r.status_code == 200, r.text
        cf = r.json().get("changed_fields") or []
        for f in ("zone_id", "needs_delivery", "delivery_charge", "custom_delivery_charge"):
            assert f in cf, f"{f} missing from changed_fields"
        o, _ = _find_order(super_headers, primary_order_id)
        assert o and o.get("zone_id") == "custom"
        assert o.get("needs_delivery") is True
        assert float(o.get("delivery_charge", 0)) == 50.0
        assert float(o.get("custom_delivery_charge", 0)) == 75.0

    def test_patch_outlet_id_and_order_taken_by(self, super_headers, primary_order_id, outlet_id):
        # Same outlet id (still valid) + order_taken_by = a fake user id string
        body = {"outlet_id": outlet_id, "order_taken_by": "user-taker-uuid"}
        r = requests.patch(f"{BASE_URL}/api/orders/{primary_order_id}",
                           headers=super_headers, json=body, timeout=20)
        assert r.status_code == 200, r.text
        cf = r.json().get("changed_fields") or []
        assert "outlet_id" in cf and "order_taken_by" in cf
        o, _ = _find_order(super_headers, primary_order_id)
        assert o and o.get("outlet_id") == outlet_id
        assert o.get("order_taken_by") == "user-taker-uuid"

    def test_patch_is_hold_lifecycle_and_status(self, super_headers, primary_order_id):
        body = {"is_hold": False, "lifecycle_status": "active", "status": "pending"}
        r = requests.patch(f"{BASE_URL}/api/orders/{primary_order_id}",
                           headers=super_headers, json=body, timeout=20)
        assert r.status_code == 200, r.text
        cf = r.json().get("changed_fields") or []
        for f in ("is_hold", "lifecycle_status", "status"):
            assert f in cf, f"{f} missing"
        o, _ = _find_order(super_headers, primary_order_id)
        assert o and o.get("is_hold") is False
        assert o.get("lifecycle_status") == "active"
        assert o.get("status") == "pending"

    def test_patch_voice_instruction_url(self, super_headers, primary_order_id):
        body = {"voice_instruction_url": "/uploads/voice.mp3"}
        r = requests.patch(f"{BASE_URL}/api/orders/{primary_order_id}",
                           headers=super_headers, json=body, timeout=20)
        assert r.status_code == 200, r.text
        cf = r.json().get("changed_fields") or []
        assert "voice_instruction_url" in cf
        o, _ = _find_order(super_headers, primary_order_id)
        assert o and o.get("voice_instruction_url") == "/uploads/voice.mp3"


# ---------- 4. pending_amount recalc + normalize_pending ----------

class TestPendingRecalc:
    def test_total_amount_update_recalcs_pending(self, super_headers, primary_order_id):
        # Fetch current paid_amount to build a proper expectation
        o_before, _ = _find_order(super_headers, primary_order_id)
        paid = float(o_before.get("paid_amount") or 0)

        # Case A: whole-number diff — pending should equal total - paid
        new_total = paid + 1234.0
        r = requests.patch(f"{BASE_URL}/api/orders/{primary_order_id}",
                           headers=super_headers,
                           json={"total_amount": new_total}, timeout=20)
        assert r.status_code == 200, r.text
        o, _ = _find_order(super_headers, primary_order_id)
        assert float(o.get("total_amount")) == pytest.approx(new_total, abs=0.01)
        assert float(o.get("pending_amount")) == pytest.approx(1234.0, abs=0.01)

        # Case B: dust (<1) — should be zeroed by normalize_pending
        # Set total = paid + 0.4 so pending would be 0.4 → normalized to 0
        dust_total = paid + 0.4
        r = requests.patch(f"{BASE_URL}/api/orders/{primary_order_id}",
                           headers=super_headers,
                           json={"total_amount": dust_total}, timeout=20)
        assert r.status_code == 200, r.text
        o2, _ = _find_order(super_headers, primary_order_id)
        assert float(o2.get("pending_amount")) == 0.0, \
            f"expected dust to be zeroed, got pending_amount={o2.get('pending_amount')}"


# ---------- 5. Super Admin edits after is_ready=true ----------

class TestSuperAdminBypassAfterReady:
    def test_super_admin_can_edit_after_ready(self, super_headers, primary_order_id):
        # Force is_ready=True via PATCH (super admin is allowed to set any field)
        r = requests.patch(
            f"{BASE_URL}/api/orders/{primary_order_id}",
            headers=super_headers,
            json={"lifecycle_status": "active", "status": "ready"}, timeout=20,
        )
        assert r.status_code == 200, r.text
        # Now hit the mark-ready endpoint to actually set is_ready=True
        # (PATCH doesn't include is_ready in allowed_fields, so we use the dedicated route)
        # Need outlet_id — reuse the primary order's outlet
        o, _ = _find_order(super_headers, primary_order_id)
        assert o is not None
        outlet_id_local = o.get("outlet_id")
        if not o.get("is_ready"):
            r_mr = requests.post(
                f"{BASE_URL}/api/orders/{primary_order_id}/mark-ready",
                headers=super_headers,
                params={"transfer_to_outlet_id": outlet_id_local},
                timeout=20,
            )
            assert r_mr.status_code == 200, f"mark-ready failed: {r_mr.status_code} {r_mr.text}"

        # Confirm is_ready=True
        o2, _ = _find_order(super_headers, primary_order_id)
        assert o2 and o2.get("is_ready") is True

        # Super admin PATCH after ready → should still succeed
        r_patch = requests.patch(
            f"{BASE_URL}/api/orders/{primary_order_id}",
            headers=super_headers,
            json={"special_instructions": "TEST post-ready super admin edit"},
            timeout=20,
        )
        assert r_patch.status_code == 200, \
            f"super admin post-ready edit failed: {r_patch.status_code} {r_patch.text}"


# ---------- 6. Non-super-admin blocked after ready ----------

class TestNonSuperBlockedAfterReady:
    def test_outlet_admin_cannot_edit_after_ready(
        self, super_headers, outlet_admin_headers, outlet_id
    ):
        # Create a fresh order and mark it ready as super admin
        payload = _new_order_payload(outlet_id, "readyblock")
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                          headers=super_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]

        r_mr = requests.post(
            f"{BASE_URL}/api/orders/{oid}/mark-ready",
            headers=super_headers,
            params={"transfer_to_outlet_id": outlet_id},
            timeout=20,
        )
        assert r_mr.status_code == 200, r_mr.text

        # Outlet admin tries to PATCH the ready order → 400 with the exact detail
        r_bad = requests.patch(
            f"{BASE_URL}/api/orders/{oid}",
            headers=outlet_admin_headers,
            json={"special_instructions": "should be blocked"},
            timeout=20,
        )
        assert r_bad.status_code == 400, f"expected 400, got {r_bad.status_code}: {r_bad.text}"
        detail = r_bad.json().get("detail", "")
        assert "Cannot edit order after it's marked as ready" in detail, \
            f"unexpected detail: {detail}"


# ---------- 7. Activity log persistence ----------

class TestActivityLog:
    def test_order_updated_activity_log_entry(self, super_headers, primary_order_id):
        # Trigger one more PATCH so a fresh entry exists
        r = requests.patch(
            f"{BASE_URL}/api/orders/{primary_order_id}",
            headers=super_headers,
            json={"special_instructions": "TEST activity-log tick"},
            timeout=20,
        )
        assert r.status_code == 200, r.text

        # Query activity logs filtered by action_type=order_updated
        r_logs = requests.get(
            f"{BASE_URL}/api/activity-logs",
            headers=super_headers,
            params={"action_type": "order_updated", "limit": 500},
            timeout=20,
        )
        assert r_logs.status_code == 200, r_logs.text
        logs = r_logs.json()
        # Filter client-side by entity_id since backend has no entity_id filter
        matching = [l for l in logs if l.get("entity_id") == primary_order_id]
        assert matching, f"no order_updated activity log for order {primary_order_id}"
        # At least one entry must have non-empty before_data + after_data
        good = [l for l in matching if l.get("before_data") and l.get("after_data")]
        assert good, \
            f"no activity log entry has both before_data and after_data. sample={matching[0]}"


# ---------- 8. WhatsApp notification doesn't crash PATCH (AiSensy missing) ----------

class TestWhatsAppBgTolerance:
    def test_patch_returns_200_without_aisensy(self, super_headers, primary_order_id):
        # This is essentially covered above — one more PATCH to be explicit.
        r = requests.patch(
            f"{BASE_URL}/api/orders/{primary_order_id}",
            headers=super_headers,
            json={"name_on_cake": "TEST tolerance"},
            timeout=20,
        )
        assert r.status_code == 200, \
            f"PATCH failed (bg WhatsApp may have blocked): {r.status_code} {r.text}"


# ---------- 9. secondary_images list ----------

class TestSecondaryImages:
    def test_secondary_images_list_persists(self, super_headers, primary_order_id):
        imgs = [f"/uploads/{c}.jpg" for c in "abcde"]
        r = requests.patch(
            f"{BASE_URL}/api/orders/{primary_order_id}",
            headers=super_headers, json={"secondary_images": imgs}, timeout=20,
        )
        assert r.status_code == 200, r.text
        o, _ = _find_order(super_headers, primary_order_id)
        assert o is not None
        got = o.get("secondary_images") or []
        assert len(got) == 5, f"expected 5, got {len(got)}: {got}"
        assert got == imgs


# ---------- 10. DELETE by super admin — deleted_from_* fields ----------

class TestDeleteBySuperAdmin:
    def test_super_delete_stores_pre_delete_status(self, super_headers, outlet_id):
        # Create a fresh order to delete
        payload = _new_order_payload(outlet_id, "supdel")
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                          headers=super_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]

        # Snapshot pre-delete status/lifecycle_status
        o_before, _ = _find_order(super_headers, oid)
        assert o_before is not None
        pre_status = o_before.get("status")
        pre_lifecycle = o_before.get("lifecycle_status")

        r_del = requests.delete(
            f"{BASE_URL}/api/orders/{oid}",
            headers=super_headers,
            params={"reason": "test-delete"},
            timeout=20,
        )
        assert r_del.status_code == 200, r_del.text

        r_gd = requests.get(f"{BASE_URL}/api/orders/deleted",
                            headers=super_headers, timeout=20)
        assert r_gd.status_code == 200, r_gd.text
        deleted = r_gd.json()
        assert isinstance(deleted, list)
        match = next((o for o in deleted if o.get("id") == oid), None)
        assert match is not None, "deleted order missing from /orders/deleted"
        assert "deleted_from_status" in match, "deleted_from_status missing"
        assert "deleted_from_lifecycle_status" in match, "deleted_from_lifecycle_status missing"
        assert match["deleted_from_status"] == pre_status
        assert match["deleted_from_lifecycle_status"] == pre_lifecycle


# ---------- 11. Non-super delete → approve → same fields ----------

class TestDeleteApproveFlow:
    def test_non_super_delete_then_approve_stores_fields(
        self, super_headers, outlet_admin_headers, outlet_id,
    ):
        # Create a fresh order
        payload = _new_order_payload(outlet_id, "appdel")
        r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false",
                          headers=super_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]

        # Snapshot pre-delete status/lifecycle_status
        o_before, _ = _find_order(super_headers, oid)
        assert o_before is not None
        pre_status = o_before.get("status")
        pre_lifecycle = o_before.get("lifecycle_status")

        # Outlet admin requests delete
        r_req = requests.delete(
            f"{BASE_URL}/api/orders/{oid}",
            headers=outlet_admin_headers,
            params={"reason": "please delete this test order"},
            timeout=20,
        )
        assert r_req.status_code == 200, r_req.text

        # Super admin approves
        r_app = requests.post(
            f"{BASE_URL}/api/orders/{oid}/approve-delete",
            headers=super_headers, timeout=20,
        )
        assert r_app.status_code == 200, r_app.text

        # GET /orders/deleted
        r_gd = requests.get(f"{BASE_URL}/api/orders/deleted",
                            headers=super_headers, timeout=20)
        assert r_gd.status_code == 200, r_gd.text
        match = next((o for o in r_gd.json() if o.get("id") == oid), None)
        assert match is not None
        assert "deleted_from_status" in match and "deleted_from_lifecycle_status" in match
        assert match["deleted_from_status"] == pre_status
        assert match["deleted_from_lifecycle_status"] == pre_lifecycle


# ---------- 12. Route sanity: /orders/deleted is not shadowed ----------

class TestDeletedRouteSanity:
    def test_deleted_route_returns_array(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/orders/deleted",
                         headers=super_headers, timeout=20)
        assert r.status_code == 200, \
            f"/api/orders/deleted returned {r.status_code}: {r.text}"
        assert isinstance(r.json(), list)


# ---------- 13. Enum sanity — server started without errors ----------

class TestEnumStartupSanity:
    def test_authenticated_endpoint_reachable(self, super_headers):
        # If ORDER_UPDATED enum broke import, server wouldn't even start.
        # Hit any authenticated endpoint to confirm normal behavior.
        r = requests.get(f"{BASE_URL}/api/outlets", headers=super_headers, timeout=20)
        assert r.status_code == 200
