"""
Role Permission Management Routes
Allows Super Admin to configure default permissions for each role
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Optional
from pydantic import BaseModel
from datetime import datetime, timezone
import sys
sys.path.append('/app/backend')

from server import get_current_user, User, UserRole, AVAILABLE_PERMISSIONS

router = APIRouter(prefix="/permissions", tags=["permissions"])


class RolePermissionTemplate(BaseModel):
    """Template for default permissions for a role"""
    role: str
    permissions: List[str]
    description: Optional[str] = None
    updated_at: datetime
    updated_by: str


class UpdateRolePermissionsRequest(BaseModel):
    role: str
    permissions: List[str]


# Get MongoDB connection
from motor.motor_asyncio import AsyncIOMotorClient
import os
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'usbakers')]


@router.get("/available")
async def get_available_permissions(current_user: User = Depends(get_current_user)):
    """
    Get all available permissions in the system
    Only Super Admin can access
    """
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admin can view permissions")
    
    return {
        "permissions": AVAILABLE_PERMISSIONS,
        "roles": [role.value for role in UserRole]
    }


@router.get("/roles")
async def get_all_role_permissions(current_user: User = Depends(get_current_user)):
    """
    Get configured permissions for all roles
    Only Super Admin can access
    """
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admin can manage permissions")
    
    # Get all role permission templates
    templates = await db.role_permissions.find({}, {"_id": 0}).to_list(100)
    
    # If no templates exist, return default templates
    if not templates:
        templates = get_default_role_permissions()
    
    return {"role_permissions": templates}


@router.get("/roles/{role}")
async def get_role_permissions(role: str, current_user: User = Depends(get_current_user)):
    """
    Get default permissions for a specific role
    """
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admin can view role permissions")
    
    template = await db.role_permissions.find_one({"role": role}, {"_id": 0})
    
    if not template:
        # Return default permissions for this role
        defaults = get_default_role_permissions()
        template = next((t for t in defaults if t["role"] == role), None)
        if not template:
            template = {"role": role, "permissions": [], "description": "No permissions set"}
    
    return template


@router.post("/roles")
async def update_role_permissions(
    request: UpdateRolePermissionsRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Update default permissions for a role
    Only Super Admin can update
    """
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admin can update role permissions")
    
    # Validate permissions exist
    all_permissions = []
    for category in AVAILABLE_PERMISSIONS.values():
        all_permissions.extend(category.keys())
    
    invalid_perms = [p for p in request.permissions if p not in all_permissions]
    if invalid_perms:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid permissions: {', '.join(invalid_perms)}"
        )
    
    # Update or insert role permission template
    template = {
        "role": request.role,
        "permissions": request.permissions,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.role_permissions.update_one(
        {"role": request.role},
        {"$set": template},
        upsert=True
    )
    
    return {
        "message": f"Permissions updated for role: {request.role}",
        "template": template
    }


@router.post("/apply-to-existing-users/{role}")
async def apply_permissions_to_existing_users(
    role: str,
    current_user: User = Depends(get_current_user)
):
    """
    Apply role's default permissions to all existing users with that role
    Only Super Admin can execute
    """
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admin can apply permissions")
    
    # Get role template
    template = await db.role_permissions.find_one({"role": role})
    if not template:
        raise HTTPException(status_code=404, detail=f"No permission template found for role: {role}")
    
    # Update all users with this role
    result = await db.users.update_many(
        {"role": role},
        {"$set": {"permissions": template["permissions"]}}
    )
    
    return {
        "message": f"Applied permissions to {result.modified_count} users",
        "role": role,
        "modified_count": result.modified_count
    }


def get_default_role_permissions():
    """
    Returns default permission templates for all roles
    """
    return [
        {
            "role": "super_admin",
            "permissions": [
                # All permissions
                "can_create_order", "can_view_orders", "can_edit_orders", "can_delete_orders", "can_mark_ready",
                "can_edit_customer_info", "can_edit_flavour", "can_edit_size", "can_edit_delivery_date",
                "can_edit_delivery_time", "can_edit_total_amount", "can_edit_special_instructions",
                "can_edit_cake_image", "can_edit_name_on_cake",
                "can_record_payment", "can_view_payments", "can_refund",
                "can_manage_outlets", "can_manage_zones", "can_manage_users", "can_view_reports", "can_manage_settings",
                "can_assign_delivery", "can_view_delivery_orders", "can_mark_delivered"
            ],
            "description": "Full system access",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": "system"
        },
        {
            "role": "outlet_admin",
            "permissions": [
                "can_create_order", "can_view_orders", "can_edit_orders",
                "can_edit_customer_info", "can_edit_flavour", "can_edit_size",
                "can_edit_delivery_date", "can_edit_delivery_time", "can_edit_special_instructions",
                "can_edit_cake_image", "can_edit_name_on_cake",
                "can_record_payment", "can_view_payments",
                "can_view_reports", "can_assign_delivery"
            ],
            "description": "Manage outlet operations",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": "system"
        },
        {
            "role": "order_manager",
            "permissions": [
                "can_create_order", "can_view_orders", "can_edit_orders",
                "can_edit_customer_info", "can_edit_flavour", "can_edit_size",
                "can_edit_delivery_date", "can_edit_delivery_time", "can_edit_special_instructions",
                "can_view_payments"
            ],
            "description": "Manage orders only",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": "system"
        },
        {
            "role": "kitchen",
            "permissions": [
                "can_view_orders", "can_mark_ready"
            ],
            "description": "Kitchen operations",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": "system"
        },
        {
            "role": "delivery",
            "permissions": [
                "can_view_delivery_orders", "can_mark_delivered"
            ],
            "description": "Delivery operations",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": "system"
        },
        {
            "role": "accounts",
            "permissions": [
                "can_view_orders", "can_record_payment", "can_view_payments", "can_refund", "can_view_reports"
            ],
            "description": "Financial operations",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": "system"
        }
    ]
