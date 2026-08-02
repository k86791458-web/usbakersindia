"""
Seed data for iteration 10 UI testing (Batch A quick-fixes).
Creates:
  - 3 orders (2 active in manage/pending, 1 to be soft-deleted with deleted_from stage)
  - Long special_instructions (multi-line) for edit test
  - petpooja_bill_numbers injected via Mongo for KOT petpooja test
  - Customer birthday + pending_amount for Customers page filter/sort test
"""
import os
import sys
import json
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dough-delivery-41.preview.emergentagent.com").rstrip("/")


def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@usbakers.com", "password": "admin123"}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def create_order(h, outlet_id, delivery_date, extra=None):
    payload = {
        "order_type": "self",
        "customer_info": {"name": "TEST Batch A Customer", "phone": "7712345001",
                          "gender": "male", "birthday": "1990-07-17"},
        "outlet_id": outlet_id,
        "occasion": "Birthday",
        "flavour": "Chocolate",
        "size_pounds": 1.5,
        "cake_image_url": "/uploads/test.jpg",
        "delivery_date": delivery_date,
        "delivery_time": "18:00",
        "total_amount": 1200,
        "needs_delivery": False,
        "special_instructions": "Line1 of instructions\nLine2 next line\nLine3 with even more details for testing textarea newlines and word wrap behaviour on manage orders page and edit dialog view",
    }
    if extra:
        payload.update(extra)
    r = requests.post(f"{BASE_URL}/api/orders?is_punch_order=true", headers=h, json=payload)
    print("create_order:", r.status_code, r.text[:150])
    j = r.json()
    return j.get("order_id") or (j.get("order") or {}).get("id")


def main():
    tok = admin_token()
    h = hdr(tok)
    outlets = requests.get(f"{BASE_URL}/api/outlets", headers=h).json()
    outlet_id = outlets[0]["id"]
    d1 = (datetime.now() + timedelta(days=3)).date().isoformat()
    d2 = (datetime.now() + timedelta(days=4)).date().isoformat()
    d3 = (datetime.now() + timedelta(days=5)).date().isoformat()

    o1 = create_order(h, outlet_id, d1)
    o2 = create_order(h, outlet_id, d2, {"customer_info": {"name": "TEST Petpooja Customer", "phone": "7712345002"}})
    o3 = create_order(h, outlet_id, d3, {"customer_info": {"name": "TEST Deleted Customer", "phone": "7712345003"}})

    # Inject petpooja_bill_numbers into o2 via mongo (no API to set them arbitrarily; we go through motor)
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

    async def patch_db():
        client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "test_database")]
        # petpooja bill nos + outlet name check
        await db.orders.update_one(
            {"id": o2},
            {"$set": {"petpooja_bill_numbers": ["PP-TEST-1001", "PP-TEST-1002"]}},
        )
        # Mark o3 as deleted with deleted_from_lifecycle_status='hold'
        await db.orders.update_one(
            {"id": o3},
            {"$set": {
                "is_deleted": True,
                "deleted_at": datetime.utcnow(),
                "deleted_from_lifecycle_status": "hold",
                "deleted_from_status": "on_hold",
                "delete_reason": "TEST deletion via seed_iteration_10",
                "deleted_by_name": "Super Admin",
            }},
        )
        client.close()

    asyncio.run(patch_db())

    # Report
    out = {
        "order_manage_edit_special_instructions": o1,
        "order_petpooja_bill_test": o2,
        "order_deleted_stage_test": o3,
        "outlet_id": outlet_id,
    }
    print(json.dumps(out, indent=2))
    return out


if __name__ == "__main__":
    main()
