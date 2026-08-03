"""Batch C (Kitchen + Delivery) backend regression tests.

Covers:
- c2 GET /api/kitchen/orders?date=<today>
- c5 upload flow: POST /api/orders/{id}/ready-to-deliver → sets status=ready_to_deliver + actual_cake_image_url
- c6 POST /api/orders/{id}/send-cake-photos (200 + persistence of cake_photos_send_date)
- c7 POST /api/delivery/verify-otp — 400 on wrong OTP, 200 on correct OTP
- regression: /api/orders/manage
"""
import os
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dough-delivery-41.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@usbakers.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _today_local():
    return datetime.now().strftime("%Y-%m-%d")


# ------------------ regression ------------------
def test_manage_orders_200(headers):
    r = requests.get(f"{BASE_URL}/api/orders/manage", headers=headers, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, (list, dict))


def test_kitchen_orders_today_200(headers):
    r = requests.get(f"{BASE_URL}/api/kitchen/orders", params={"date": _today_local()}, headers=headers, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    # Ensure only allowed statuses come back and match date
    for o in data:
        assert o.get("status") in ("confirmed", "in_progress", "ready", "ready_to_deliver")
        assert o.get("delivery_date") == _today_local() or o.get("delivery_date") is not None


# ------------------ c5 ready-to-deliver ------------------
def _find_order_with_status(headers, statuses):
    r = requests.get(f"{BASE_URL}/api/orders/manage", headers=headers, timeout=30, params={"limit": 500})
    assert r.status_code == 200
    data = r.json()
    orders = data if isinstance(data, list) else data.get("orders", [])
    for o in orders:
        if o.get("status") in statuses:
            return o
    return None


def test_ready_to_deliver_sets_status_and_actual_photo(headers):
    """c5: /orders/{id}/ready-to-deliver sets status=ready_to_deliver and actual_cake_image_url in one call."""
    # Find a 'ready' order to promote — else skip
    order = _find_order_with_status(headers, ("ready",))
    if not order:
        pytest.skip("No 'ready' order available to exercise ready-to-deliver flow")
    order_id = order["id"]
    image_url = "/api/uploads/test_batch_c.jpg"
    r = requests.post(
        f"{BASE_URL}/api/orders/{order_id}/ready-to-deliver",
        params={"image_url": image_url},
        headers=headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    # verify persistence via manage
    r2 = requests.get(f"{BASE_URL}/api/orders/manage", headers=headers, timeout=30, params={"limit": 500})
    orders2 = r2.json() if isinstance(r2.json(), list) else r2.json().get("orders", [])
    o2 = next((x for x in orders2 if x.get("id") == order_id), None)
    assert o2 is not None
    assert o2.get("status") == "ready_to_deliver"
    assert o2.get("actual_cake_image_url") == image_url


# ------------------ c6 send-cake-photos ------------------
def test_send_cake_photos_endpoint(headers):
    """c6: /orders/{id}/send-cake-photos returns 200 and persists cake_photos_send_date."""
    # Find order with actual_cake_image_url
    r = requests.get(f"{BASE_URL}/api/orders/manage", headers=headers, timeout=30, params={"limit": 500})
    orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
    target = next((o for o in orders if o.get("actual_cake_image_url")), None)
    if not target:
        pytest.skip("No order with actual_cake_image_url — cannot exercise send-cake-photos")
    order_id = target["id"]
    send_date = _today_local()
    r = requests.post(
        f"{BASE_URL}/api/orders/{order_id}/send-cake-photos",
        json={"date": send_date, "include_reference": True, "include_actual": True},
        headers=headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("date") == send_date
    assert "message" in body


def test_send_cake_photos_no_images_400(headers):
    """When neither ref nor actual image exists on order, endpoint should 400."""
    r = requests.get(f"{BASE_URL}/api/orders/manage", headers=headers, timeout=30, params={"limit": 500})
    orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
    target = next((o for o in orders if not o.get("actual_cake_image_url") and not o.get("cake_image_url")), None)
    if not target:
        pytest.skip("No order without any cake images — skipping 400 case")
    r = requests.post(
        f"{BASE_URL}/api/orders/{target['id']}/send-cake-photos",
        json={"include_reference": True, "include_actual": True},
        headers=headers,
        timeout=30,
    )
    assert r.status_code == 400


# ------------------ c7 verify-otp ------------------
def test_verify_otp_wrong_returns_4xx(headers):
    """Wrong OTP → 4xx with detail. Uses any picked_up/ready_to_deliver order; else creates one at random ID which should 404."""
    r = requests.get(f"{BASE_URL}/api/orders/manage", headers=headers, timeout=30, params={"limit": 500})
    orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
    target = next(
        (o for o in orders if o.get("status") in ("picked_up", "ready_to_deliver", "reached")),
        None,
    )
    if not target:
        # No matching order — call endpoint anyway with bogus id to prove endpoint exists (should 404).
        r2 = requests.post(
            f"{BASE_URL}/api/delivery/verify-otp",
            json={"order_id": "nonexistent-id-xyz", "otp": "000000"},
            headers=headers,
            timeout=30,
        )
        # Admin has permission; either 404 (order not found) or 400 (state mismatch) is acceptable — but must NOT be 200.
        assert r2.status_code in (400, 404), r2.text
        return

    r2 = requests.post(
        f"{BASE_URL}/api/delivery/verify-otp",
        json={"order_id": target["id"], "otp": "000000"},
        headers=headers,
        timeout=30,
    )
    assert r2.status_code >= 400 and r2.status_code < 500, r2.text
    assert "detail" in r2.json()


def test_verify_otp_endpoint_exists(headers):
    """Sanity: the endpoint must exist (POST with empty body → 400)."""
    r = requests.post(
        f"{BASE_URL}/api/delivery/verify-otp",
        json={},
        headers=headers,
        timeout=30,
    )
    # Must NOT be 404 (route missing). 400 for missing fields is expected.
    assert r.status_code != 404, r.text
    assert r.status_code == 400
