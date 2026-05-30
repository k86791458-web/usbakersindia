import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv(Path(__file__).parent / ".env")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Check if admin exists
    existing = await db.users.find_one({"role": "super_admin"})
    
    if not existing:
        print("Creating super admin...")
        admin = {
            "id": "admin-001",
            "email": "admin@usbakers.com",
            "name": "Super Admin",
            "phone": "1234567890",
            "role": "super_admin",
            "password_hash": pwd_context.hash("admin123"),
            "outlet_id": None,
            "is_active": True,
            "created_at": "2024-01-01T00:00:00"
        }
        await db.users.insert_one(admin)
        print("✅ Super admin created!")
    else:
        print("✅ Super admin already exists")
        print(f"Email: {existing['email']}")
    
    client.close()

asyncio.run(create_admin())
