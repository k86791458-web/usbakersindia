"""
Seed data for iteration 9 UI testing (Group B — Delivery Flow Frontend).
Creates:
  - Delivery user (email: TEST_delivery_ui9@usbakers.com / pass: delpass123)
  - Zone (delivery_charge=100)
  - City (Chennai_ui9, Bengaluru_ui9)
  - Order A: needs_delivery=true, is_ready=true, no actual_cake_image_url → for "Upload Image" button test
  - Order B: needs_delivery=false, status='ready_to_deliver' → for "Add Delivery" wizard test
  - Order C: needs_delivery=true, status='picked_up', assigned to delivery user → for OTP verification test
Prints JSON summary of created data.
"""
import os, sys, json, requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sweet-shop-165.preview.emergentagent.com").rstrip("/")


def _admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@usbakers.com", "password": "admin123"}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def seed():
    tok = _admin_token()
    h = _hdr(tok)
    out = {}

    # Ensure a zone
    zones = requests.get(f"{BASE_URL}/api/zones", headers=h).json()
    zone = next((z for z in zones if z.get("delivery_charge") == 100 and z.get("is_active", True)), None)
    if not zone:
        zr = requests.post(f"{BASE_URL}/api/zones", headers=h, json={"name": "TEST_UI9_Zone", "delivery_charge": 100})
        zone = zr.json().get("zone") or zr.json()
    out["zone"] = zone

    # Cities
    cities = requests.get(f"{BASE_URL}/api/cities", headers=h).json()
    if not any(c.get("name", "").lower() == "chennai_ui9" for c in cities):
        requests.post(f"{BASE_URL}/api/cities", headers=h, json={"name": "Chennai_ui9"})
    if not any(c.get("name", "").lower() == "bengaluru_ui9" for c in cities):
        requests.post(f"{BASE_URL}/api/cities", headers=h, json={"name": "Bengaluru_ui9"})

    # Delivery user
    delivery_email = "test_delivery_ui9@usbakers.com"
    users = requests.get(f"{BASE_URL}/api/users", headers=h).json()
    du = next((u for u in users if u.get("email", "").lower() == delivery_email), None)
    if not du:
        cu = requests.post(f"{BASE_URL}/api/users", headers=h, json={
            "email": delivery_email,
            "password": "delpass123",
            "name": "TEST Delivery UI9",
            "phone": "9998887777",
            "role": "delivery"
        })
        du = cu.json().get("user") or cu.json()
    out["delivery_user"] = {"id": du.get("id"), "email": du.get("email")}

    # Ensure outlet
    outlets = requests.get(f"{BASE_URL}/api/outlets", headers=h).json()
    if isinstance(outlets, dict):
        outlets = outlets.get("outlets", [])
    outlet_id = outlets[0]["id"] if outlets else None
    out["outlet_id"] = outlet_id

    from datetime import datetime, timedelta
    tomorrow = (datetime.now() + timedelta(days=2)).date().isoformat()

    def base_order_payload(need_delivery, extra=None):
        p = {
            "order_type": "self",
            "customer_info": {"name": "TEST UI9 Customer", "phone": "7777777777", "gender": "male"},
            "outlet_id": outlet_id,
            "occasion": "Birthday",
            "flavour": "Chocolate",
            "size_pounds": 1.5,
            "cake_image_url": "/uploads/test.jpg",
            "delivery_date": tomorrow,
            "delivery_time": "18:00",
            "total_amount": 1000,
            "needs_delivery": need_delivery,
        }
        if need_delivery:
            p["zone_id"] = zone["id"]
            p["delivery_address"] = "123 Delivery St"
            p["delivery_city"] = "Chennai_ui9"
            p["receiver_info"] = {"name": "Receiver X", "phone": "8888888888", "address": "123 Delivery St"}
        if extra:
            p.update(extra)
        return p

    # Order A: delivery order, ready but no image
    oa = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false", headers=h, json=base_order_payload(True))
    print("Order A create status:", oa.status_code, oa.text[:200])
    oa_j = oa.json()
    order_a_id = oa_j.get("order_id") or (oa_j.get("order", {}) if isinstance(oa_j, dict) else {}).get("id")
    # Mark is_ready via PATCH
    if order_a_id:
        pa = requests.patch(f"{BASE_URL}/api/orders/{order_a_id}", headers=h, json={"is_ready": True})
        print("Order A mark ready:", pa.status_code, pa.text[:150])
    out["order_a_upload_test"] = order_a_id

    # Order B: non-delivery, status=ready_to_deliver
    ob = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false", headers=h, json=base_order_payload(False))
    print("Order B create status:", ob.status_code, ob.text[:200])
    ob_j = ob.json()
    order_b_id = ob_j.get("order_id") or (ob_j.get("order", {}) if isinstance(ob_j, dict) else {}).get("id")
    if order_b_id:
        pb = requests.patch(f"{BASE_URL}/api/orders/{order_b_id}", headers=h, json={"status": "ready_to_deliver"})
        print("Order B set status:", pb.status_code, pb.text[:150])
    out["order_b_add_delivery_test"] = order_b_id

    # Order C: picked_up delivery order assigned to delivery user
    oc = requests.post(f"{BASE_URL}/api/orders?is_punch_order=false", headers=h, json=base_order_payload(True))
    print("Order C create status:", oc.status_code, oc.text[:200])
    oc_j = oc.json()
    order_c_id = oc_j.get("order_id") or (oc_j.get("order", {}) if isinstance(oc_j, dict) else {}).get("id")
    if order_c_id:
        # Move to ready_to_deliver first (may need is_ready flag set)
        pr = requests.patch(f"{BASE_URL}/api/orders/{order_c_id}", headers=h, json={"is_ready": True, "status": "ready_to_deliver"})
        print("Order C set ready_to_deliver:", pr.status_code, pr.text[:150])
        # Assign delivery person via query param (this auto-sets status=picked_up per server.py)
        ar = requests.post(f"{BASE_URL}/api/delivery/assign-order/{order_c_id}?delivery_person_id={du['id']}", headers=h)
        print("Order C assign delivery:", ar.status_code, ar.text[:200])
        # Fetch OTP from /manage list (GET /orders/{id} is not exposed)
        gm = requests.get(f"{BASE_URL}/api/orders/manage", headers=h).json()
        order_c = next((o for o in gm if o.get("id") == order_c_id), {})
        out["order_c_otp_test"] = {
            "id": order_c_id,
            "status": order_c.get("status"),
            "delivery_otp": order_c.get("delivery_otp"),
            "assigned_delivery_partner": order_c.get("assigned_delivery_partner"),
            "receiver_info": order_c.get("receiver_info"),
            "customer_info": order_c.get("customer_info"),
        }

    print(json.dumps(out, indent=2, default=str))
    return out


if __name__ == "__main__":
    seed()
