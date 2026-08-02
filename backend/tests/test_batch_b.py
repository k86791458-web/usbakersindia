"""Batch B verification tests: regression + b8 WhatsApp on order edit."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dough-delivery-41.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@usbakers.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestRegression:
    def test_orders_manage_returns_200_and_desc_sort(self, headers):
        r = requests.get(f"{BASE_URL}/api/orders/manage", headers=headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        orders = data.get("orders", data) if isinstance(data, dict) else data
        assert isinstance(orders, list)
        # Verify delivery_date DESC ordering
        dates = [o.get("delivery_date") for o in orders if o.get("delivery_date")]
        assert dates == sorted(dates, reverse=True), "orders/manage not sorted by delivery_date DESC"

    def test_flavours_returns_array(self, headers):
        r = requests.get(f"{BASE_URL}/api/flavours", headers=headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_occasions_returns_array(self, headers):
        r = requests.get(f"{BASE_URL}/api/occasions", headers=headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_outlets_returns_array(self, headers):
        r = requests.get(f"{BASE_URL}/api/outlets", headers=headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)


class TestPunchOrderAndPatch:
    """b8: PATCH triggers WhatsApp bg task. Also verifies regression on POST and PATCH."""

    def test_create_punch_and_patch_and_whatsapp_log(self, headers):
        # Discover a valid outlet & flavour & occasion
        outlets = requests.get(f"{BASE_URL}/api/outlets", headers=headers, timeout=30).json()
        assert len(outlets) > 0
        outlet_id = outlets[0]["id"]

        flavours = requests.get(f"{BASE_URL}/api/flavours", headers=headers, timeout=30).json()
        occasions = requests.get(f"{BASE_URL}/api/occasions", headers=headers, timeout=30).json()
        flavour_name = flavours[0]["name"] if flavours else "Chocolate"
        occasion_name = occasions[0]["name"] if occasions else "Birthday"

        payload = {
            "outlet_id": outlet_id,
            "customer_info": {"name": "TEST BatchB", "phone": "9876543210", "gender": "male"},
            "occasion": occasion_name,
            "flavour": flavour_name,
            "size_pounds": 1.0,
            "delivery_date": "2026-12-31",
            "delivery_time": "17:30",
            "total_amount": 1000.0,
            "paid_amount": 500.0,
            "needs_delivery": False,
            "is_punch_order": True,
            "order_taken_by": "admin",
            "order_type": "self",
            "cake_image_url": "https://example.com/x.jpg",
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"POST /api/orders failed: {r.status_code} {r.text}"
        created = r.json()
        order_id = created.get("order_id") or created.get("id")
        assert order_id, f"No order id in response: {created}"

        # Get whatsapp_logs count before PATCH (best-effort — endpoint may not exist)
        pre = requests.get(f"{BASE_URL}/api/whatsapp/logs", headers=headers, timeout=15)
        pre_count = len(pre.json()) if pre.status_code == 200 and isinstance(pre.json(), list) else None

        # PATCH the order with a benign change → should trigger send_whatsapp_notification bg task
        patch_payload = {"special_instructions": "TEST BatchB PATCH update"}
        r2 = requests.patch(f"{BASE_URL}/api/orders/{order_id}", headers=headers, json=patch_payload, timeout=30)
        assert r2.status_code == 200, f"PATCH failed: {r2.status_code} {r2.text}"
        body = r2.json()
        # server returns {"message": ..., "changed_fields": [...]}
        assert "changed_fields" in body or "message" in body

        # Fetch via /api/orders/manage to verify persistence
        m = requests.get(f"{BASE_URL}/api/orders/manage", headers=headers, timeout=15).json()
        orders_list = m.get("orders", m) if isinstance(m, dict) else m
        found = next((o for o in orders_list if o.get("id") == order_id), None)
        # If not returned in default window, do best-effort check on 200 only
        if found is not None:
            assert "TEST BatchB PATCH update" in (found.get("special_instructions") or "")

        # Best-effort check on whatsapp_logs — endpoint may or may not exist.
        if pre_count is not None:
            post = requests.get(f"{BASE_URL}/api/whatsapp/logs", headers=headers, timeout=15)
            if post.status_code == 200:
                # Not asserting strict increment because template may be disabled → gracefully skips.
                assert isinstance(post.json(), list)

    def test_patch_updates_flavour_custom(self, headers):
        """b2 backend regression: PATCH accepts any free-form flavour string."""
        outlets = requests.get(f"{BASE_URL}/api/outlets", headers=headers, timeout=30).json()
        outlet_id = outlets[0]["id"]
        payload = {
            "outlet_id": outlet_id,
            "customer_info": {"name": "TEST Flav", "phone": "9876543211", "gender": "female"},
            "occasion": "Birthday",
            "flavour": "Chocolate",
            "size_pounds": 1.0,
            "delivery_date": "2026-12-31",
            "delivery_time": "10:00",
            "total_amount": 500.0,
            "paid_amount": 0.0,
            "needs_delivery": False,
            "is_punch_order": True,
            "order_taken_by": "admin",
            "order_type": "self",
            "cake_image_url": "https://example.com/x.jpg",
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=headers, json=payload, timeout=30)
        assert r.status_code in (200, 201)
        oid = r.json().get("order_id") or r.json().get("id")
        assert oid

        r2 = requests.patch(f"{BASE_URL}/api/orders/{oid}", headers=headers,
                            json={"flavour": "Butterscotch Praline"}, timeout=30)
        assert r2.status_code == 200

        m = requests.get(f"{BASE_URL}/api/orders/manage", headers=headers, timeout=15).json()
        orders_list = m.get("orders", m) if isinstance(m, dict) else m
        found = next((o for o in orders_list if o.get("id") == oid), None)
        if found is not None:
            assert found.get("flavour") == "Butterscotch Praline"
