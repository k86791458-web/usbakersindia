"""
One-time cleanup: For all orders where 0 < pending_amount < 1 (rounding dust),
set pending_amount to 0. Reports counts before exiting.

Usage:
    cd /app/backend && python cleanup_pending_dust.py
    (or on VPS: cd /home/usbakers/usbakers-crm/backend && python cleanup_pending_dust.py)
"""
import asyncio
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv(Path(__file__).parent / ".env")

DUST_THRESHOLD = 1.0


async def cleanup():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    query = {
        "pending_amount": {"$gt": 0, "$lt": DUST_THRESHOLD}
    }

    affected = await db.orders.count_documents(query)
    print(f"Found {affected} orders with pending dust (0 < pending < ₹{DUST_THRESHOLD}).")

    if affected == 0:
        print("Nothing to clean. Done.")
        client.close()
        return

    result = await db.orders.update_many(
        query,
        {"$set": {
            "pending_amount": 0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    print(f"Updated {result.modified_count} orders. pending_amount set to 0.")

    # Also handle negative dust (over-paid by < ₹1 due to rounding)
    neg_query = {"pending_amount": {"$gt": -DUST_THRESHOLD, "$lt": 0}}
    neg_affected = await db.orders.count_documents(neg_query)
    if neg_affected > 0:
        neg_result = await db.orders.update_many(
            neg_query,
            {"$set": {
                "pending_amount": 0,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        print(f"Also normalized {neg_result.modified_count} orders with small negative pending.")

    client.close()
    print("Cleanup complete.")


if __name__ == "__main__":
    asyncio.run(cleanup())
