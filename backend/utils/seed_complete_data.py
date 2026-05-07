#!/usr/bin/env python3
"""
Complete seed data for US Bakers - Including Sales Persons and Orders
"""
import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv
import random

# Load environment
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Database connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'usbakers')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

async def seed_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("\n🧹 Clearing existing data...")
    await db.users.delete_many({})
    await db.outlets.delete_many({})
    await db.zones.delete_many({})
    await db.customers.delete_many({})
    await db.orders.delete_many({})
    await db.payments.delete_many({})
    await db.sales_persons.delete_many({})
    await db.system_settings.delete_many({})
    print("✅ Data cleared\n")
    
    # System Settings
    print("⚙️ Creating system settings...")
    system_settings = {
        "id": "system_settings",
        "minimum_payment_percentage": 20.0,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.system_settings.insert_one(system_settings)
    print("✅ System settings created\n")
    
    # Users
    print("👥 Creating users...")
    users = [
        {
            "id": "user-admin",
            "name": "Super Admin",
            "email": "admin@usbakers.com",
            "password_hash": hash_password("admin123"),
            "phone": "9876543200",
            "role": "super_admin",
            "outlet_id": None,
            "is_active": True,
            "permissions": ["all"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "user-dhangu",
            "name": "Satyam (Dhangu Road)",
            "email": "satyam@usbakers.com",
            "password_hash": hash_password("satyam123"),
            "phone": "9876543201",
            "role": "outlet_admin",
            "outlet_id": "outlet-dhangu",
            "is_active": True,
            "permissions": ["can_create_order", "can_view_orders", "can_edit_orders", "can_view_reports"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "user-railway",
            "name": "Sushant (Railway Road)",
            "email": "sushant@usbakers.com",
            "password_hash": hash_password("sushant123"),
            "phone": "9876543202",
            "role": "outlet_admin",
            "outlet_id": "outlet-railway",
            "is_active": True,
            "permissions": ["can_create_order", "can_view_orders", "can_edit_orders", "can_view_reports"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "user-factory",
            "name": "Factory Manager",
            "email": "factory@usbakers.com",
            "password_hash": hash_password("factory123"),
            "phone": "9876543203",
            "role": "kitchen",
            "outlet_id": None,
            "is_active": True,
            "permissions": ["can_view_orders", "can_mark_ready"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.users.insert_many(users)
    print(f"✅ {len(users)} users created\n")
    
    # Outlets
    print("🏪 Creating outlets...")
    outlets = [
        {
            "id": "outlet-dhangu",
            "name": "Dhangu Road",
            "address": "123 Dhangu Road, Dehradun",
            "city": "Dehradun",
            "phone": "9876543210",
            "username": "dhangu_outlet",
            "ready_time_buffer_minutes": 30,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "outlet-railway",
            "name": "Railway Road",
            "address": "456 Railway Road, Dehradun",
            "city": "Dehradun",
            "phone": "9876543211",
            "username": "railway_outlet",
            "ready_time_buffer_minutes": 30,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.outlets.insert_many(outlets)
    print(f"✅ {len(outlets)} outlets created\n")
    
    # Zones
    print("📍 Creating delivery zones...")
    zones = [
        # Dhangu Road zones
        {"id": "zone-dhangu-1", "name": "Dhangu Central", "outlet_id": "outlet-dhangu", "delivery_charge": 50, "is_active": True},
        {"id": "zone-dhangu-2", "name": "Dhangu North", "outlet_id": "outlet-dhangu", "delivery_charge": 75, "is_active": True},
        {"id": "zone-dhangu-3", "name": "Dhangu South", "outlet_id": "outlet-dhangu", "delivery_charge": 60, "is_active": True},
        # Railway Road zones
        {"id": "zone-railway-1", "name": "Railway Central", "outlet_id": "outlet-railway", "delivery_charge": 50, "is_active": True},
        {"id": "zone-railway-2", "name": "Railway East", "outlet_id": "outlet-railway", "delivery_charge": 80, "is_active": True},
        {"id": "zone-railway-3", "name": "Railway West", "outlet_id": "outlet-railway", "delivery_charge": 70, "is_active": True},
    ]
    await db.zones.insert_many(zones)
    print(f"✅ {len(zones)} zones created\n")
    
    # Sales Persons
    print("💼 Creating sales persons...")
    sales_persons = [
        {"id": "sp-1", "name": "Rahul Kumar", "phone": "9876543210", "outlet_id": "outlet-dhangu", "is_active": True, "created_by": "user-admin", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "sp-2", "name": "Priya Sharma", "phone": "9876543211", "outlet_id": "outlet-dhangu", "is_active": True, "created_by": "user-admin", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "sp-3", "name": "Amit Singh", "phone": "9876543212", "outlet_id": "outlet-railway", "is_active": True, "created_by": "user-admin", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "sp-4", "name": "Sneha Gupta", "phone": "9876543213", "outlet_id": "outlet-railway", "is_active": True, "created_by": "user-admin", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "sp-5", "name": "Vikash Verma", "phone": "9876543214", "outlet_id": "outlet-dhangu", "is_active": True, "created_by": "user-admin", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.sales_persons.insert_many(sales_persons)
    print(f"✅ {len(sales_persons)} sales persons created\n")
    
    # Customers
    print("👨‍👩‍👧‍👦 Creating customers...")
    customers = [
        {"id": "cust-1", "name": "Rajesh Patel", "phone": "9999999991", "email": "rajesh@example.com", "address": "123 Main St, Dehradun", "birthday": "1990-05-15"},
        {"id": "cust-2", "name": "Anjali Mehta", "phone": "9999999992", "email": "anjali@example.com", "address": "456 Park Ave, Dehradun", "birthday": "1988-08-22"},
        {"id": "cust-3", "name": "Suresh Yadav", "phone": "9999999993", "email": "suresh@example.com", "address": "789 Lake Rd, Dehradun", "birthday": "1995-03-10"},
        {"id": "cust-4", "name": "Meena Joshi", "phone": "9999999994", "email": "meena@example.com", "address": "321 Hill St, Dehradun", "birthday": "1992-11-05"},
        {"id": "cust-5", "name": "Rakesh Sharma", "phone": "9999999995", "email": "rakesh@example.com", "address": "654 Valley Rd, Dehradun", "birthday": "1985-07-18"},
    ]
    await db.customers.insert_many(customers)
    print(f"✅ {len(customers)} customers created\n")
    
    # Orders - Different states
    print("📦 Creating orders in different states...\n")
    
    order_counter = 1
    
    # 1. PENDING ORDERS (waiting for payment)
    print("  ⏳ Creating PENDING orders (waiting for 20% payment)...")
    pending_orders = []
    for i in range(3):
        order_date = (datetime.now(timezone.utc) - timedelta(days=i)).isoformat()
        delivery_date = (datetime.now(timezone.utc) + timedelta(days=2+i)).strftime('%Y-%m-%d')
        
        outlet_id = "outlet-dhangu" if i % 2 == 0 else "outlet-railway"
        zone = zones[i]
        sales_person = sales_persons[i]
        customer = customers[i]
        
        cake_amount = random.choice([800, 1000, 1200, 1500])
        delivery_charge = zone['delivery_charge']
        total_amount = cake_amount + delivery_charge
        
        order = {
            "id": f"order-pending-{i+1}",
            "order_number": f"USB-{datetime.now().strftime('%Y%m%d')}-{str(order_counter).zfill(3)}",
            "order_type": "self",
            "customer_info": {"name": customer['name'], "phone": customer['phone']},
            "needs_delivery": True,
            "delivery_address": customer['address'],
            "zone_id": zone['id'],
            "occasion": random.choice(["Birthday", "Anniversary", "Wedding"]),
            "flavour": random.choice(["Chocolate", "Vanilla", "Black Forest", "Pineapple"]),
            "size_pounds": random.choice([1, 2, 3]),
            "cake_image_url": "https://via.placeholder.com/400",
            "name_on_cake": customer['name'].split()[0],
            "delivery_date": delivery_date,
            "delivery_time": "18:00",
            "status": "pending",
            "lifecycle_status": "pending_payment",
            "outlet_id": outlet_id,
            "created_by": "user-admin",
            "order_taken_by": sales_person['id'],
            "is_punch_order": True,
            "total_amount": total_amount,
            "paid_amount": 0,
            "pending_amount": total_amount,
            "is_hold": False,
            "is_deleted": False,
            "created_at": order_date,
            "updated_at": order_date
        }
        pending_orders.append(order)
        order_counter += 1
    
    await db.orders.insert_many(pending_orders)
    print(f"  ✅ {len(pending_orders)} pending orders created\n")
    
    # 2. HOLD ORDERS (incomplete info)
    print("  📋 Creating HOLD orders (incomplete, awaiting completion)...")
    hold_orders = []
    for i in range(2):
        order_date = (datetime.now(timezone.utc) - timedelta(hours=i*6)).isoformat()
        
        outlet_id = "outlet-railway" if i % 2 == 0 else "outlet-dhangu"
        customer = customers[i+3]
        
        cake_amount = random.choice([600, 800, 1000])
        
        order = {
            "id": f"order-hold-{i+1}",
            "order_number": f"USB-{datetime.now().strftime('%Y%m%d')}-{str(order_counter).zfill(3)}",
            "order_type": "self",
            "customer_info": {"name": customer['name'], "phone": customer['phone']},
            "needs_delivery": False,
            "occasion": random.choice(["Birthday", "Anniversary"]),
            "flavour": random.choice(["Chocolate", "Vanilla"]),
            "size_pounds": 1,
            "cake_image_url": "https://via.placeholder.com/400",
            "delivery_date": "",  # Incomplete
            "delivery_time": "",  # Incomplete
            "status": "on_hold",
            "lifecycle_status": "hold",
            "outlet_id": outlet_id,
            "created_by": "user-dhangu" if i % 2 == 0 else "user-railway",
            "order_taken_by": sales_persons[i+1]['id'],
            "is_punch_order": False,
            "total_amount": cake_amount,
            "paid_amount": 0,
            "pending_amount": cake_amount,
            "is_hold": True,
            "is_deleted": False,
            "created_at": order_date,
            "updated_at": order_date
        }
        hold_orders.append(order)
        order_counter += 1
    
    await db.orders.insert_many(hold_orders)
    print(f"  ✅ {len(hold_orders)} hold orders created\n")
    
    # 3. ACTIVE ORDERS (in manage orders - paid enough)
    print("  ✅ Creating ACTIVE orders (in Manage Orders)...")
    active_orders = []
    for i in range(5):
        order_date = (datetime.now(timezone.utc) - timedelta(days=i+1)).isoformat()
        delivery_date = (datetime.now(timezone.utc) + timedelta(days=1+i)).strftime('%Y-%m-%d')
        
        outlet_id = "outlet-dhangu" if i % 2 == 0 else "outlet-railway"
        zone = zones[i]
        sales_person = sales_persons[i % len(sales_persons)]
        customer = customers[i % len(customers)]
        
        cake_amount = random.choice([1000, 1500, 2000, 2500])
        delivery_charge = zone['delivery_charge'] if i % 3 != 0 else 0
        total_amount = cake_amount + delivery_charge
        paid_amount = total_amount * random.choice([0.3, 0.5, 0.8, 1.0])  # Various payment states
        
        order = {
            "id": f"order-active-{i+1}",
            "order_number": f"USB-{datetime.now().strftime('%Y%m%d')}-{str(order_counter).zfill(3)}",
            "order_type": "self",
            "customer_info": {"name": customer['name'], "phone": customer['phone']},
            "needs_delivery": i % 3 != 0,
            "delivery_address": customer['address'] if i % 3 != 0 else "",
            "zone_id": zone['id'] if i % 3 != 0 else None,
            "occasion": random.choice(["Birthday", "Anniversary", "Wedding", "Party"]),
            "flavour": random.choice(["Chocolate", "Vanilla", "Black Forest", "Pineapple", "Butterscotch"]),
            "size_pounds": random.choice([1, 2, 3]),
            "cake_image_url": "https://via.placeholder.com/400",
            "name_on_cake": customer['name'].split()[0],
            "delivery_date": delivery_date,
            "delivery_time": random.choice(["12:00", "15:00", "18:00", "21:00"]),
            "status": "confirmed",
            "lifecycle_status": "active",
            "outlet_id": outlet_id,
            "created_by": "user-admin",
            "order_taken_by": sales_person['id'],
            "is_punch_order": True,
            "total_amount": total_amount,
            "paid_amount": paid_amount,
            "pending_amount": total_amount - paid_amount,
            "is_hold": False,
            "is_deleted": False,
            "payment_synced_from_petpooja": True,
            "created_at": order_date,
            "updated_at": order_date
        }
        active_orders.append(order)
        order_counter += 1
    
    await db.orders.insert_many(active_orders)
    print(f"  ✅ {len(active_orders)} active orders created\n")
    
    # Payments for active orders
    print("💰 Creating payment records...")
    payments = []
    for i, order in enumerate(active_orders):
        if order['paid_amount'] > 0:
            payment = {
                "id": f"payment-{i+1}",
                "order_id": order['id'],
                "order_number": order['order_number'],
                "amount": order['paid_amount'],
                "payment_method": random.choice(["cash", "card", "upi", "online"]),
                "paid_at": order['created_at'],
                "outlet_id": order['outlet_id'],
                "petpooja_bill_number": f"BILL-{i+1}",
                "payment_source": "petpooja_auto"
            }
            payments.append(payment)
    
    if payments:
        await db.payments.insert_many(payments)
    print(f"✅ {len(payments)} payment records created\n")
    
    # Summary
    print("\n" + "="*60)
    print("📊 DATA SEEDING COMPLETE!")
    print("="*60)
    print(f"\n👥 Users: {len(users)}")
    print(f"   • Super Admin: admin@usbakers.com / admin123")
    print(f"   • Dhangu Admin: satyam@usbakers.com / satyam123")
    print(f"   • Railway Admin: sushant@usbakers.com / sushant123")
    print(f"   • Factory: factory@usbakers.com / factory123")
    
    print(f"\n🏪 Outlets: {len(outlets)}")
    print(f"   • Dhangu Road")
    print(f"   • Railway Road")
    
    print(f"\n📍 Zones: {len(zones)}")
    print(f"   • 3 zones per outlet")
    
    print(f"\n💼 Sales Persons: {len(sales_persons)}")
    print(f"   • Dhangu Road: Rahul, Priya, Vikash")
    print(f"   • Railway Road: Amit, Sneha")
    
    print(f"\n👨‍👩‍👧‍👦 Customers: {len(customers)}")
    
    print(f"\n📦 Orders: {len(pending_orders) + len(hold_orders) + len(active_orders)}")
    print(f"   ⏳ Pending (waiting for payment): {len(pending_orders)}")
    print(f"   📋 Hold (incomplete): {len(hold_orders)}")
    print(f"   ✅ Active (in Manage Orders): {len(active_orders)}")
    
    print(f"\n💰 Payments: {len(payments)}")
    
    print(f"\n⚙️ System Settings:")
    print(f"   • Minimum Payment Percentage: 20%")
    
    print("\n" + "="*60)
    print("🚀 Ready to use! Login and explore:")
    print("   • Sales Persons management")
    print("   • Pending Orders (auto-refresh)")
    print("   • Hold Orders (can be released)")
    print("   • Manage Orders (active orders)")
    print("   • Create new Punch/Hold orders")
    print("="*60 + "\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_data())
