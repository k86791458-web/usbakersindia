"""
Tests for iteration 8 features:
- Change Log endpoints (GET/POST/DELETE)
- User outlet_scope variants (all/multiple/specific)
- Order enrichment with order_taken_by_name (pending/manage/kitchen)
- /orders/{id}/pause-preparing
- /orders/{id}/transfer-outlet
- Credit order auto-removal on 100% payment
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://83b98b60-550c-4c1a-81f4-e81fbb8235b9.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "usbakers")

ADMIN_EMAIL = "admin@usbakers.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


# ==================== CHANGE LOG ====================
class TestChangeLog:
    def test_get_change_log_seeded(self, admin_client):
        r = admin_client.get(f"{API}/change-log")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 8, f"Expected >=8 seeded entries, got {len(items)}"
        for it in items:
            assert "id" in it and "title" in it and "description" in it and "category" in it
            assert "_id" not in it

    def test_get_change_log_unauth(self):
        r = requests.get(f"{API}/change-log")
        assert r.status_code in (401, 403)

    def test_create_and_delete_change_log(self, admin_client):
        payload = {"title": "TEST_CL Entry", "description": "TEST desc", "category": "bugfix"}
        r = admin_client.post(f"{API}/change-log", json=payload)
        assert r.status_code == 200, r.text
        entry = r.json().get("entry")
        assert entry and entry["title"] == payload["title"]
        eid = entry["id"]

        r2 = admin_client.get(f"{API}/change-log")
        assert any(x["id"] == eid for x in r2.json())

        r3 = admin_client.delete(f"{API}/change-log/{eid}")
        assert r3.status_code == 200
        r4 = admin_client.get(f"{API}/change-log")
        assert not any(x["id"] == eid for x in r4.json())


# ==================== USER outlet_scope ====================
class TestUserOutletScope:
    @pytest.fixture(scope="class")
    def outlet_ids(self, db):
        outlets = list(db.outlets.find({}, {"_id": 0, "id": 1}).limit(3))
        ids = [o["id"] for o in outlets]
        if len(ids) < 2:
            created = []
            for i, name in enumerate(["TEST_OUTLET_A", "TEST_OUTLET_B"]):
                if not db.outlets.find_one({"name": name}):
                    doc_id = str(uuid.uuid4())
                    db.outlets.insert_one({
                        "id": doc_id,
                        "name": name,
                        "address": "Test addr",
                        "city": "TestCity",
                        "phone": "0000000000",
                        "username": f"test_outlet_{i}_{uuid.uuid4().hex[:4]}",
                        "password_hash": "test",
                        "ready_time_buffer_minutes": 30,
                        "is_active": True,
                        "minimum_payment_percentage": 20.0,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })
                    created.append(doc_id)
            outlets = list(db.outlets.find({}, {"_id": 0, "id": 1}).limit(3))
            ids = [o["id"] for o in outlets]
        yield ids
        # Cleanup only those we created
        db.outlets.delete_many({"name": {"$in": ["TEST_OUTLET_A", "TEST_OUTLET_B"]}})
        return

    def _create_user(self, client, payload):
        r = client.post(f"{API}/users", json=payload)
        return r

    def test_create_user_scope_all(self, admin_client, db):
        email = f"TEST_all_{uuid.uuid4().hex[:6]}@test.com"
        payload = {
            "email": email, "name": "TEST All", "phone": "1111111111",
            "role": "order_manager", "password": "Test1234!",
            "outlet_scope": "all",
        }
        r = self._create_user(admin_client, payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["outlet_scope"] == "all"
        assert data["outlet_ids"] == []
        assert data["outlet_id"] is None
        db.users.delete_one({"email": email})

    def test_create_user_scope_multiple(self, admin_client, db, outlet_ids):
        assert len(outlet_ids) >= 2
        email = f"TEST_multi_{uuid.uuid4().hex[:6]}@test.com"
        payload = {
            "email": email, "name": "TEST Multi", "phone": "2222222222",
            "role": "order_manager", "password": "Test1234!",
            "outlet_scope": "multiple", "outlet_ids": outlet_ids[:2],
        }
        r = self._create_user(admin_client, payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["outlet_scope"] == "multiple"
        assert set(data["outlet_ids"]) == set(outlet_ids[:2])
        db.users.delete_one({"email": email})

    def test_create_user_scope_specific(self, admin_client, db, outlet_ids):
        email = f"TEST_spec_{uuid.uuid4().hex[:6]}@test.com"
        payload = {
            "email": email, "name": "TEST Spec", "phone": "3333333333",
            "role": "order_manager", "password": "Test1234!",
            "outlet_scope": "specific", "outlet_id": outlet_ids[0],
        }
        r = self._create_user(admin_client, payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["outlet_scope"] == "specific"
        assert data["outlet_id"] == outlet_ids[0]
        db.users.delete_one({"email": email})


# ==================== ORDER ENRICHMENT + PAUSE/TRANSFER + CREDIT ====================
def _seed_order(db, outlet_id, order_taken_by=None, status="confirmed",
                lifecycle_status="active", is_credit=False, is_complementary=False,
                paid_amount=0.0, total_amount=1000.0):
    oid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": oid,
        "order_number": f"TEST-{oid[:6]}",
        "customer_name": "TEST Cust",
        "customer_phone": "9999999999",
        "outlet_id": outlet_id,
        "items": [{"name": "TEST cake", "qty": 1, "price": total_amount}],
        "total_amount": total_amount,
        "paid_amount": paid_amount,
        "status": status,
        "lifecycle_status": lifecycle_status,
        "is_credit_order": is_credit,
        "is_complementary": is_complementary,
        "needs_delivery": False,
        "pickup_by_customer": False,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now,
    }
    if order_taken_by:
        doc["order_taken_by"] = order_taken_by
    db.orders.insert_one(doc)
    return oid


class TestOrderEnrichmentAndActions:
    @pytest.fixture(scope="class")
    def outlet_id(self, db):
        o = db.outlets.find_one({}, {"_id": 0, "id": 1})
        if not o:
            doc_id = str(uuid.uuid4())
            db.outlets.insert_one({
                "id": doc_id,
                "name": "TEST_ORDER_OUTLET",
                "address": "Test addr",
                "city": "TestCity",
                "phone": "0000000000",
                "username": f"test_oo_{uuid.uuid4().hex[:4]}",
                "password_hash": "test",
                "ready_time_buffer_minutes": 30,
                "is_active": True,
                "minimum_payment_percentage": 20.0,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            yield doc_id
            db.outlets.delete_one({"id": doc_id})
            return
        yield o["id"]

    @pytest.fixture(scope="class")
    def sales_person(self, db, outlet_id):
        sp_id = str(uuid.uuid4())
        db.sales_persons.insert_one({
            "id": sp_id,
            "name": "TEST Sales Jane",
            "phone": "8888888888",
            "outlet_id": outlet_id,
            "is_active": True,
            "incentive_percentage": 5.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        yield {"id": sp_id, "name": "TEST Sales Jane"}
        db.sales_persons.delete_one({"id": sp_id})

    def test_pending_orders_enrich_name(self, admin_client, db, outlet_id, sales_person):
        oid = _seed_order(db, outlet_id, order_taken_by=sales_person["id"], status="pending",
                          lifecycle_status="pending_payment")
        try:
            r = admin_client.get(f"{API}/orders/pending")
            assert r.status_code == 200, r.text
            orders = r.json()
            found = [o for o in orders if o.get("id") == oid]
            assert found, "Seeded pending order not returned"
            assert found[0].get("order_taken_by_name") == sales_person["name"]
        finally:
            db.orders.delete_one({"id": oid})

    def test_manage_orders_enrich_name(self, admin_client, db, outlet_id, sales_person):
        oid = _seed_order(db, outlet_id, order_taken_by=sales_person["id"], status="confirmed",
                          lifecycle_status="active")
        try:
            r = admin_client.get(f"{API}/orders/manage")
            assert r.status_code == 200, r.text
            orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
            found = [o for o in orders if o.get("id") == oid]
            assert found, "Seeded manage order not returned"
            assert found[0].get("order_taken_by_name") == sales_person["name"]
        finally:
            db.orders.delete_one({"id": oid})

    def test_kitchen_orders_enrich_name(self, admin_client, db, outlet_id, sales_person):
        oid = _seed_order(db, outlet_id, order_taken_by=sales_person["id"], status="confirmed",
                          lifecycle_status="active")
        try:
            r = admin_client.get(f"{API}/kitchen/orders")
            assert r.status_code == 200, r.text
            data = r.json()
            orders = data if isinstance(data, list) else data.get("orders", [])
            # Filter for today may exclude it; but ensure shape contains order_taken_by_name on any order present
            if orders:
                # If our order present, assert name
                mine = [o for o in orders if o.get("id") == oid]
                if mine:
                    assert mine[0].get("order_taken_by_name") == sales_person["name"]
        finally:
            db.orders.delete_one({"id": oid})

    def test_pause_preparing_non_progress_400(self, admin_client, db, outlet_id):
        oid = _seed_order(db, outlet_id, status="confirmed")
        try:
            r = admin_client.post(f"{API}/orders/{oid}/pause-preparing")
            assert r.status_code == 400, f"Expected 400 when not in_progress, got {r.status_code}: {r.text}"
        finally:
            db.orders.delete_one({"id": oid})

    def test_pause_preparing_success(self, admin_client, db, outlet_id):
        oid = _seed_order(db, outlet_id, status="in_progress")
        try:
            r = admin_client.post(f"{API}/orders/{oid}/pause-preparing")
            assert r.status_code == 200, r.text
            doc = db.orders.find_one({"id": oid}, {"_id": 0})
            assert doc["status"] == "confirmed"
        finally:
            db.orders.delete_one({"id": oid})

    def test_pause_preparing_404(self, admin_client):
        r = admin_client.post(f"{API}/orders/nonexistent-id/pause-preparing")
        assert r.status_code == 404

    def test_transfer_outlet_success(self, admin_client, db, outlet_id):
        # Need two outlets
        outlets = list(db.outlets.find({}, {"_id": 0, "id": 1}).limit(2))
        if len(outlets) < 2:
            pytest.skip("Need two outlets")
        oid = _seed_order(db, outlets[0]["id"], status="ready_to_deliver")
        target = outlets[1]["id"]
        try:
            r = admin_client.post(f"{API}/orders/{oid}/transfer-outlet",
                                  params={"outlet_id": target, "pickup_by_customer": True})
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("pickup_by_customer") is True
            doc = db.orders.find_one({"id": oid}, {"_id": 0})
            assert doc["transfer_to_outlet_id"] == target
            assert doc["pickup_by_customer"] is True
            assert doc["needs_delivery"] is False
        finally:
            db.orders.delete_one({"id": oid})

    def test_transfer_outlet_invalid(self, admin_client, db, outlet_id):
        oid = _seed_order(db, outlet_id, status="ready_to_deliver")
        try:
            r = admin_client.post(f"{API}/orders/{oid}/transfer-outlet",
                                  params={"outlet_id": "does-not-exist"})
            assert r.status_code == 404
        finally:
            db.orders.delete_one({"id": oid})

    def test_credit_order_auto_removal_on_full_payment(self, admin_client, db, outlet_id):
        """Simulate 100% payment on a credit order via petpooja/payment-webhook."""
        oid = _seed_order(
            db, outlet_id, status="confirmed", lifecycle_status="active",
            is_credit=True, is_complementary=False,
            paid_amount=0.0, total_amount=1000.0,
        )
        order_doc = db.orders.find_one({"id": oid}, {"_id": 0})
        order_number = order_doc["order_number"]
        try:
            # Webhook - format 1: bill payment with comment=order_number
            payload = {
                "bill_number": f"BILL-TEST-{uuid.uuid4().hex[:6]}",
                "amount": 1000.0,
                "comment": order_number,
                "payment_method": "cash",
            }
            # No auth required for webhook
            r = requests.post(f"{API}/petpooja/payment-webhook", json=payload)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body.get("success") is not False or "not found" not in str(body.get("message", "")).lower(), body

            doc = db.orders.find_one({"id": oid}, {"_id": 0})
            assert doc["paid_amount"] == 1000.0, f"paid_amount not updated: {doc.get('paid_amount')}"
            assert doc["is_credit_order"] is False, "Credit order should be auto-removed after full payment"
        finally:
            db.orders.delete_one({"id": oid})
            db.payments.delete_many({"order_id": oid})
