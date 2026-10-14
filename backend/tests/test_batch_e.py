"""Batch E backend tests: user rights/edit/delete, trusted devices (2FA), delivery person report."""
import os
import uuid
import hashlib
import pytest
import requests
import pyotp
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN_EMAIL = "admin@usbakers.com"
ADMIN_PASSWORD = "admin123"
SA2FA_EMAIL = "sa2fa@usbakers.com"
SA2FA_PASSWORD = "test123"
SA2FA_TOTP_SECRET = "BJQWTDXMQ4BKUKNBUUBT4MHBI7RT7WDW"

PREFIX = "TEST_batch_e"


@pytest.fixture(scope="module")
def db():
    cli = MongoClient(MONGO_URL)
    return cli[DB_NAME]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["requires_2fa"] is False
    return data["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Permissions available ----------
def test_permissions_available_has_pages_group(admin_headers):
    r = requests.get(f"{API}/permissions/available", headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    # expected structure: dict of groups -> {perm_key: label}
    groups = data.get("permissions", data)
    assert "pages" in groups, f"'pages' group missing. keys={list(groups.keys())}"
    pages = groups["pages"]
    for key in ["page_dashboard", "page_users", "page_delivery_report", "page_cake_image_report"]:
        assert key in pages, f"{key} missing in pages group"


# ---------- Create user auto-fills role defaults ----------
@pytest.fixture
def order_manager_user(admin_headers, db):
    email = f"{PREFIX}_om_{uuid.uuid4().hex[:6]}@usbakers.com"
    payload = {
        "email": email, "name": "TEST OM", "phone": "9999900001",
        "role": "order_manager", "password": "Password123!",
        "permissions": []
    }
    r = requests.post(f"{API}/users", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    u = r.json()
    assert u["role"] == "order_manager"
    yield u
    db.users.delete_one({"id": u["id"]})


def test_create_user_autofills_page_perms(order_manager_user):
    perms = order_manager_user.get("permissions", [])
    # order_manager inherits _ORDER_PAGES
    for pg in ["page_dashboard", "page_new_order", "page_manage_orders"]:
        assert pg in perms, f"{pg} missing in order_manager default perms: {perms}"
    # should NOT have page_users
    assert "page_users" not in perms


# ---------- require_role grants via mapped permission ----------
def test_require_role_grants_via_permission(order_manager_user, admin_headers):
    # Login as the order_manager
    r = requests.post(f"{API}/auth/login", json={"email": order_manager_user["email"], "password": "Password123!"})
    assert r.status_code == 200, r.text
    om_token = r.json()["access_token"]
    om_headers = {"Authorization": f"Bearer {om_token}"}

    # Without page_users -> 403 on /users
    r = requests.get(f"{API}/users", headers=om_headers)
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    # aisensy/config should also 403 (no page_whatsapp_settings granted even after we add page_users)
    r_ai_before = requests.get(f"{API}/aisensy/config", headers=om_headers)
    assert r_ai_before.status_code == 403

    # Grant page_users via PATCH
    new_perms = list(order_manager_user["permissions"]) + ["page_users"]
    r = requests.patch(
        f"{API}/users/{order_manager_user['id']}/permissions",
        json={"permissions": new_perms},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text

    # Re-login to refresh token's underlying perms (perms are read live by DB each call anyway)
    r = requests.get(f"{API}/users", headers=om_headers)
    assert r.status_code == 200, f"after granting page_users expected 200, got {r.status_code}: {r.text}"

    # aisensy still 403
    r = requests.get(f"{API}/aisensy/config", headers=om_headers)
    assert r.status_code == 403, f"aisensy must still be forbidden: {r.status_code}"


# ---------- PUT /users/{id} edits ----------
def test_update_user_fields_and_duplicate_email(order_manager_user, admin_headers, db):
    uid = order_manager_user["id"]
    # Update name/phone
    r = requests.put(
        f"{API}/users/{uid}",
        json={"name": "TEST OM Updated", "phone": "9999900077"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "TEST OM Updated"
    assert body["phone"] == "9999900077"

    # Duplicate email -> 400
    r = requests.put(f"{API}/users/{uid}", json={"email": ADMIN_EMAIL}, headers=admin_headers)
    assert r.status_code == 400, r.text


def test_cannot_demote_self(admin_headers, db):
    me = db.users.find_one({"email": ADMIN_EMAIL})
    r = requests.put(
        f"{API}/users/{me['id']}",
        json={"role": "order_manager"},
        headers=admin_headers,
    )
    assert r.status_code == 400, r.text


def test_reset_permissions_to_role(order_manager_user, admin_headers):
    uid = order_manager_user["id"]
    # First overwrite perms to [] via PATCH
    r = requests.patch(f"{API}/users/{uid}/permissions", json={"permissions": []}, headers=admin_headers)
    assert r.status_code == 200
    # Now reset
    r = requests.put(f"{API}/users/{uid}", json={"reset_permissions_to_role": True}, headers=admin_headers)
    assert r.status_code == 200, r.text
    perms = r.json()["permissions"]
    assert "page_dashboard" in perms and "page_new_order" in perms


# ---------- DELETE /users/{id} ----------
def test_delete_user(admin_headers, db):
    email = f"{PREFIX}_del_{uuid.uuid4().hex[:6]}@usbakers.com"
    r = requests.post(f"{API}/users", json={
        "email": email, "name": "TEST DEL", "phone": "9999900002",
        "role": "kitchen", "password": "Password123!"
    }, headers=admin_headers)
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    r = requests.delete(f"{API}/users/{uid}", headers=admin_headers)
    assert r.status_code == 200, r.text
    # confirm gone
    assert db.users.find_one({"id": uid}) is None


def test_cannot_delete_self(admin_headers, db):
    me = db.users.find_one({"email": ADMIN_EMAIL})
    r = requests.delete(f"{API}/users/{me['id']}", headers=admin_headers)
    assert r.status_code == 400


# ---------- Delivery person report ----------
def test_delivery_person_report(admin_headers, db):
    # Create a delivery user
    email = f"{PREFIX}_dp_{uuid.uuid4().hex[:6]}@usbakers.com"
    r = requests.post(f"{API}/users", json={
        "email": email, "name": "TEST DP", "phone": "9999900050",
        "role": "delivery", "password": "Password123!"
    }, headers=admin_headers)
    assert r.status_code == 200, r.text
    dp = r.json()
    dp_id = dp["id"]

    today = datetime.now(timezone(timedelta(hours=5, minutes=30))).strftime("%Y-%m-%d")
    # Seed orders directly in DB to avoid WhatsApp side effects
    order_ids = []
    def _seed(status, delivered_at=None, pending=100.0, delivery_time="17:30 - 18:00"):
        oid = str(uuid.uuid4())
        doc = {
            "id": oid,
            "order_number": f"TBE-{uuid.uuid4().hex[:6]}",
            "customer_info": {"name": "TEST customer", "phone": "9999900099"},
            "customer_name": "TEST customer",
            "customer_phone": "9999900099",
            "items": [], "total_amount": 500.0, "pending_amount": pending,
            "advance_amount": 400.0,
            "status": status, "is_deleted": False,
            "needs_delivery": True,
            "delivery_date": today, "delivery_time": delivery_time,
            "assigned_delivery_partner": dp_id,
            "assigned_delivery_partner_name": "TEST DP",
            "outlet_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "_test_marker": PREFIX,
        }
        if delivered_at:
            doc["delivered_at"] = delivered_at
        db.orders.insert_one(doc)
        order_ids.append(oid)

    # 1 pending
    _seed("picked_up", pending=250.0)
    # 1 delivered on-time (delivered_at within deadline+15min)
    # deadline = today 17:30 IST; delivered 17:00 IST
    on_time_dt = datetime.strptime(f"{today} 17:00", "%Y-%m-%d %H:%M").replace(
        tzinfo=timezone(timedelta(hours=5, minutes=30))
    ).astimezone(timezone.utc).isoformat()
    _seed("delivered", delivered_at=on_time_dt, pending=0.0)
    # 1 delivered late (delivered 20:00 IST, deadline 17:30 → late)
    late_dt = datetime.strptime(f"{today} 20:00", "%Y-%m-%d %H:%M").replace(
        tzinfo=timezone(timedelta(hours=5, minutes=30))
    ).astimezone(timezone.utc).isoformat()
    _seed("delivered", delivered_at=late_dt, pending=50.0)

    try:
        r = requests.get(
            f"{API}/reports/delivery-persons?date_from={today}&date_to={today}",
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "persons" in data and "totals" in data
        # Find our delivery person row
        row = next((p for p in data["persons"] if p.get("delivery_person_id") == dp_id), None)
        assert row is not None, f"delivery person not in report; persons={data['persons']}"
        assert row["assigned"] >= 3
        assert row["delivered"] >= 2
        assert row["pending"] >= 1
        assert row["on_time"] >= 1
        assert row["late"] >= 1
        # No 'rating' field (user said no ratings)
        assert "rating" not in row and "ratings" not in row
        assert row["cash_to_collect"] >= 250.0
        assert isinstance(row["orders"], list) and len(row["orders"]) >= 3
    finally:
        db.orders.delete_many({"_test_marker": PREFIX})
        db.users.delete_one({"id": dp_id})


# ---------- Trusted devices / 2FA ----------
def test_trusted_device_flow(db):
    # First login: challenge
    r = requests.post(f"{API}/auth/login", json={"email": SA2FA_EMAIL, "password": SA2FA_PASSWORD})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("requires_2fa") is True, j
    challenge = j["challenge_token"]

    # Verify 2FA with remember_device=True
    code = pyotp.TOTP(SA2FA_TOTP_SECRET).now()
    r = requests.post(f"{API}/auth/login/verify-2fa", json={
        "challenge_token": challenge, "code": code,
        "remember_device": True, "device_name": "TEST batch_e device"
    })
    assert r.status_code == 200, r.text
    v = r.json()
    assert v.get("requires_2fa") is False
    device_token = v.get("device_token")
    assert device_token, "device_token missing from verify-2fa response"
    sa_token = v["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # Next login WITH device_token skips 2FA
    r = requests.post(f"{API}/auth/login", json={
        "email": SA2FA_EMAIL, "password": SA2FA_PASSWORD, "device_token": device_token,
    })
    assert r.status_code == 200, r.text
    j2 = r.json()
    assert j2.get("requires_2fa") is False, f"expected skip 2FA on trusted device, got {j2}"
    assert j2.get("access_token")

    # List trusted devices (all_users=true for super admin) and ensure token_hash not exposed
    r = requests.get(f"{API}/auth/trusted-devices?all_users=true", headers=sa_headers)
    assert r.status_code == 200, r.text
    devices = r.json()
    assert isinstance(devices, list)
    mine = [d for d in devices if d.get("device_name") == "TEST batch_e device"]
    assert mine, f"inserted device not in list: {devices}"
    for d in devices:
        assert "token_hash" not in d, "token_hash leaked"

    device_id = mine[0]["id"]
    # Revoke
    r = requests.delete(f"{API}/auth/trusted-devices/{device_id}", headers=sa_headers)
    assert r.status_code == 200, r.text

    # Next login with revoked token should REQUIRE 2FA again
    r = requests.post(f"{API}/auth/login", json={
        "email": SA2FA_EMAIL, "password": SA2FA_PASSWORD, "device_token": device_token,
    })
    assert r.status_code == 200, r.text
    j3 = r.json()
    assert j3.get("requires_2fa") is True, f"revoked device should require 2FA again: {j3}"

    # cleanup any residual
    db.trusted_devices.delete_many({"device_name": "TEST batch_e device"})
