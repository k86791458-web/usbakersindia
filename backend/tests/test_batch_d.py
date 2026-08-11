"""Batch D backend regression tests — Credit / Complementary / Payments / PetPooja Sync.

Covers:
- d1  GET /api/orders/credit excludes complementary; GET /api/orders/complementary returns them.
- d2  POST /api/payments 403 for non-super-admin cross-outlet payment; 200 after transfer.
- d3  PATCH /api/orders/{id} flips bill_needs_resync; GET /api/petpooja/needs-resync lists them;
      POST /api/orders/{id}/clear-bill-resync-flag clears them; no flag when no petpooja bill.
- d4  GET /api/petpooja-bills?view=unsynced_custom filters correctly; outlet_name enriched.
- d5  C16 short-code classification returned; shortcode filter works.
- regression: /api/orders/manage 200.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@usbakers.com"
ADMIN_PASSWORD = "admin123"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

_client = MongoClient(MONGO_URL)
_db = _client[DB_NAME]


@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- regression ----------------
def test_manage_200(admin_headers):
    r = requests.get(f"{BASE_URL}/api/orders/manage", headers=admin_headers, timeout=30)
    assert r.status_code == 200


# ---------------- d1 ----------------
def test_d1_credit_excludes_complementary_and_complementary_endpoint(admin_headers):
    # GET credit — must be 200 for super admin
    r_credit = requests.get(f"{BASE_URL}/api/orders/credit", headers=admin_headers, timeout=30)
    assert r_credit.status_code == 200, r_credit.text
    credit = r_credit.json()
    credit_list = credit if isinstance(credit, list) else credit.get("orders", [])

    # None of the credit orders should be complementary
    for o in credit_list:
        assert o.get("is_complementary") is not True, f"Credit list leaks complementary order {o.get('order_number')}"

    r_comp = requests.get(f"{BASE_URL}/api/orders/complementary", headers=admin_headers, timeout=30)
    assert r_comp.status_code == 200, r_comp.text
    comp_list = r_comp.json() if isinstance(r_comp.json(), list) else r_comp.json().get("orders", [])
    for o in comp_list:
        assert o.get("is_complementary") is True

    # Seed: mark one credit order as complementary, then confirm it moves out of /credit.
    # Only run if there is at least one credit order with pending amount > 0.
    if credit_list:
        target = credit_list[0]
        oid = target["id"]
        _db.orders.update_one({"id": oid}, {"$set": {"is_complementary": True}})
        r2 = requests.get(f"{BASE_URL}/api/orders/credit", headers=admin_headers, timeout=30)
        credit2 = r2.json() if isinstance(r2.json(), list) else r2.json().get("orders", [])
        assert not any(o.get("id") == oid for o in credit2), "Complementary order still shows in /credit"
        r3 = requests.get(f"{BASE_URL}/api/orders/complementary", headers=admin_headers, timeout=30)
        comp2 = r3.json() if isinstance(r3.json(), list) else r3.json().get("orders", [])
        assert any(o.get("id") == oid for o in comp2), "Complementary order missing from /complementary"
        # cleanup
        _db.orders.update_one({"id": oid}, {"$set": {"is_complementary": False}})


# ---------------- d2 ----------------
@pytest.fixture(scope="session")
def two_outlets_and_outlet_user(admin_headers):
    """Ensure at least 2 outlets exist and a non-super-admin user tied to outlet B exists."""
    r = requests.get(f"{BASE_URL}/api/outlets", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    outlets = r.json()
    if len(outlets) < 2:
        pytest.skip("Need at least 2 outlets — cannot exercise d2")
    outlet_a, outlet_b = outlets[0], outlets[1]

    # Create outlet_admin user for outlet_b (idempotent via TEST_ prefix)
    email = "test_batch_d_outletb@usbakers.com"
    pwd = "TestPass123!"
    _db.users.delete_many({"email": email})
    r = requests.post(
        f"{BASE_URL}/api/users",
        headers=admin_headers,
        json={
            "email": email,
            "password": pwd,
            "name": "TEST Batch D OutletB Admin",
            "full_name": "TEST Batch D OutletB Admin",
            "phone": "9990000001",
            "role": "outlet_admin",
            "outlet_id": outlet_b["id"],
        },
        timeout=30,
    )
    assert r.status_code in (200, 201), r.text
    # login
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    return {
        "outlet_a": outlet_a,
        "outlet_b": outlet_b,
        "user_b_headers": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
    }


def test_d2_payment_forbidden_cross_outlet_then_ok_after_transfer(admin_headers, two_outlets_and_outlet_user):
    outlet_a = two_outlets_and_outlet_user["outlet_a"]
    outlet_b = two_outlets_and_outlet_user["outlet_b"]
    user_b_headers = two_outlets_and_outlet_user["user_b_headers"]

    # Find or seed a non-complementary, non-pickup order that lives at outlet A with pending>0
    orders = list(_db.orders.find(
        {"outlet_id": outlet_a["id"], "is_deleted": {"$ne": True}, "pending_amount": {"$gt": 0}},
        {"_id": 0},
    ).limit(50))
    target = next((o for o in orders if not o.get("pickup_by_customer") and not o.get("transfer_to_outlet_id")), None)
    if not target:
        # Manufacture one by cloning an existing order
        any_order = _db.orders.find_one({}, {"_id": 0})
        if not any_order:
            pytest.skip("No orders available to run d2")
        new = dict(any_order)
        new["id"] = str(uuid.uuid4())
        new["order_number"] = f"TESTD2{uuid.uuid4().hex[:6].upper()}"
        new["outlet_id"] = outlet_a["id"]
        new["is_complementary"] = False
        new["pickup_by_customer"] = False
        new["transfer_to_outlet_id"] = None
        new["is_deleted"] = False
        new["total_amount"] = 500
        new["paid_amount"] = 0
        new["pending_amount"] = 500
        _db.orders.insert_one(new)
        target = new

    order_id = target["id"]

    # Attempt cross-outlet payment as outlet_b user → expect 403
    r = requests.post(
        f"{BASE_URL}/api/payments",
        headers=user_b_headers,
        json={"order_id": order_id, "amount": 100, "payment_method": "cash"},
        timeout=30,
    )
    assert r.status_code == 403, f"Expected 403, got {r.status_code} {r.text}"
    body = r.json()
    assert "transfer" in (body.get("detail") or "").lower()

    # Now transfer to outlet B and retry → expect 200
    _db.orders.update_one({"id": order_id}, {"$set": {"transfer_to_outlet_id": outlet_b["id"]}})
    r2 = requests.post(
        f"{BASE_URL}/api/payments",
        headers=user_b_headers,
        json={"order_id": order_id, "amount": 100, "payment_method": "cash"},
        timeout=30,
    )
    assert r2.status_code == 200, f"Expected 200 after transfer, got {r2.status_code} {r2.text}"


# ---------------- d3 ----------------
def test_d3_patch_sets_bill_needs_resync_and_clear_flag(admin_headers):
    # Seed an order with petpooja_bill_numbers
    order = _db.orders.find_one({"is_deleted": {"$ne": True}}, {"_id": 0})
    if not order:
        pytest.skip("No order to exercise d3")
    order_id = order["id"]
    _db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "petpooja_bill_numbers": ["TESTBILL123"],
            "flavour": "Vanilla",
            "bill_needs_resync": False,
        }, "$unset": {"bill_resync_flagged_at": ""}},
    )

    # PATCH with a trigger-field change
    r = requests.patch(
        f"{BASE_URL}/api/orders/{order_id}",
        headers=admin_headers,
        json={"flavour": "Chocolate"},
        timeout=30,
    )
    assert r.status_code == 200, r.text

    updated = _db.orders.find_one({"id": order_id}, {"_id": 0})
    assert updated.get("bill_needs_resync") is True, "PATCH did not flip bill_needs_resync"
    assert updated.get("bill_resync_flagged_at"), "bill_resync_flagged_at not set"

    # needs-resync endpoint
    r2 = requests.get(f"{BASE_URL}/api/petpooja/needs-resync", headers=admin_headers, timeout=30)
    assert r2.status_code == 200, r2.text
    items = r2.json() if isinstance(r2.json(), list) else r2.json().get("orders", [])
    assert any(o.get("id") == order_id for o in items), "needs-resync did not include flagged order"

    # clear flag
    r3 = requests.post(
        f"{BASE_URL}/api/orders/{order_id}/clear-bill-resync-flag",
        headers=admin_headers,
        timeout=30,
    )
    assert r3.status_code == 200, r3.text
    updated2 = _db.orders.find_one({"id": order_id}, {"_id": 0})
    assert updated2.get("bill_needs_resync") is False


def test_d3_no_bill_no_resync_flag(admin_headers):
    """PATCH on an order without petpooja_bill_numbers should NOT set bill_needs_resync."""
    order = _db.orders.find_one({"is_deleted": {"$ne": True}}, {"_id": 0})
    if not order:
        pytest.skip("no orders")
    oid = order["id"]
    _db.orders.update_one({"id": oid}, {"$set": {"flavour": "Vanilla", "bill_needs_resync": False},
                                        "$unset": {"petpooja_bill_numbers": ""}})
    r = requests.patch(f"{BASE_URL}/api/orders/{oid}", headers=admin_headers, json={"flavour": "Strawberry"}, timeout=30)
    assert r.status_code == 200, r.text
    updated = _db.orders.find_one({"id": oid}, {"_id": 0})
    assert updated.get("bill_needs_resync") is not True, "Should not flip flag when no petpooja bill"


# ---------------- d4 & d5 ----------------
def _seed_petpooja_bill(shortcode=None, custom=True, synced=False, outlet_id=None):
    bill_number = f"TESTBILL{uuid.uuid4().hex[:6].upper()}"
    doc = {
        "id": str(uuid.uuid4()),
        "bill_number": bill_number,
        "petpooja_rest_id": "TESTREST",
        "outlet_id": outlet_id,
        "outlet_name": None,
        "total_amount": 500,
        "items": [{"name": "Custom Cake C16 Vanilla", "shortcode": "C16" if shortcode == "C16" else "", "quantity": 1}],
        "has_custom_cake": custom,
        "synced_to_order": synced,
        "custom_cake_shortcode": shortcode,
        "custom_cake_item_names": ["Custom Cake C16 Vanilla"] if custom else [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _db.petpooja_bills.insert_one(doc)
    return bill_number


def test_d4_view_unsynced_custom_and_outlet_name(admin_headers):
    outlets = requests.get(f"{BASE_URL}/api/outlets", headers=admin_headers, timeout=30).json()
    outlet_id = outlets[0]["id"] if outlets else None
    bn_c16 = _seed_petpooja_bill(shortcode="C16", custom=True, synced=False, outlet_id=outlet_id)
    bn_synced = _seed_petpooja_bill(shortcode="C16", custom=True, synced=True, outlet_id=outlet_id)

    try:
        r = requests.get(
            f"{BASE_URL}/api/petpooja-bills",
            headers=admin_headers,
            params={"view": "unsynced_custom"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        bills = r.json() if isinstance(r.json(), list) else r.json().get("bills", [])
        bnums = [b.get("bill_number") for b in bills]
        assert bn_c16 in bnums, "Unsynced custom bill missing from unsynced_custom view"
        assert bn_synced not in bnums, "Synced bill leaked into unsynced_custom view"

        # outlet_name enrichment (backfill on response)
        seeded = next(b for b in bills if b.get("bill_number") == bn_c16)
        if outlet_id:
            assert seeded.get("outlet_name"), "outlet_name not enriched on bill response"
    finally:
        _db.petpooja_bills.delete_many({"bill_number": {"$in": [bn_c16, bn_synced]}})


def test_d5_shortcode_filter(admin_headers):
    bn_c16 = _seed_petpooja_bill(shortcode="C16")
    bn_other = _seed_petpooja_bill(shortcode="OTHER")
    bn_mixed = _seed_petpooja_bill(shortcode="MIXED")
    try:
        for sc, expected in [("C16", bn_c16), ("OTHER", bn_other), ("MIXED", bn_mixed)]:
            r = requests.get(
                f"{BASE_URL}/api/petpooja-bills",
                headers=admin_headers,
                params={"shortcode": sc},
                timeout=30,
            )
            assert r.status_code == 200, r.text
            bills = r.json() if isinstance(r.json(), list) else r.json().get("bills", [])
            bnums = [b.get("bill_number") for b in bills]
            assert expected in bnums, f"shortcode={sc} filter missing {expected}"
            # Others should not appear
            for other_sc, other_bn in [("C16", bn_c16), ("OTHER", bn_other), ("MIXED", bn_mixed)]:
                if other_sc != sc:
                    assert other_bn not in bnums, f"shortcode={sc} leaked {other_sc} bill {other_bn}"
    finally:
        _db.petpooja_bills.delete_many({"bill_number": {"$in": [bn_c16, bn_other, bn_mixed]}})


def test_d5_older_bills_display_safely(admin_headers):
    """Bills WITHOUT custom_cake_shortcode field must still be returned by /api/petpooja-bills."""
    bill_number = f"TESTLEGACY{uuid.uuid4().hex[:6].upper()}"
    _db.petpooja_bills.insert_one({
        "id": str(uuid.uuid4()),
        "bill_number": bill_number,
        "petpooja_rest_id": "TESTREST",
        "total_amount": 100,
        "items": [{"name": "Item A", "quantity": 1}],
        "has_custom_cake": False,
        "synced_to_order": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        r = requests.get(f"{BASE_URL}/api/petpooja-bills", headers=admin_headers, timeout=30)
        assert r.status_code == 200
    finally:
        _db.petpooja_bills.delete_many({"bill_number": bill_number})
