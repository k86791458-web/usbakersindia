"""
Real-Time Notifications System
Server-Sent Events for order updates
"""
from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
import asyncio
import json
from typing import Dict, Set
from datetime import datetime

# Store active SSE connections per user
active_connections: Dict[str, Set[asyncio.Queue]] = {}

notification_router = APIRouter(prefix="/api/notifications")

class NotificationManager:
    """Manage real-time notifications"""
    
    def __init__(self):
        self.connections: Dict[str, Set[asyncio.Queue]] = {}
    
    async def connect(self, user_id: str) -> asyncio.Queue:
        """Add a new SSE connection"""
        queue = asyncio.Queue()
        if user_id not in self.connections:
            self.connections[user_id] = set()
        self.connections[user_id].add(queue)
        return queue
    
    async def disconnect(self, user_id: str, queue: asyncio.Queue):
        """Remove an SSE connection"""
        if user_id in self.connections:
            self.connections[user_id].discard(queue)
            if not self.connections[user_id]:
                del self.connections[user_id]
    
    async def broadcast_to_user(self, user_id: str, event: str, data: dict):
        """Send notification to specific user"""
        if user_id in self.connections:
            message = json.dumps({
                'event': event,
                'data': data,
                'timestamp': datetime.utcnow().isoformat()
            })
            
            for queue in self.connections[user_id]:
                try:
                    await queue.put(message)
                except:
                    pass
    
    async def broadcast_to_role(self, role: str, event: str, data: dict):
        """Send notification to all users with specific role"""
        # This would require maintaining role -> user_id mapping
        # For now, we'll implement per-user notifications
        pass
    
    async def broadcast_to_outlet(self, outlet_id: str, event: str, data: dict):
        """Send notification to all users in specific outlet"""
        # Similar to broadcast_to_role
        pass

# Global notification manager instance
notification_manager = NotificationManager()

@notification_router.get("/stream")
async def notification_stream(request: Request, current_user = Depends(get_current_user)):
    """
    SSE endpoint for real-time notifications
    Client connects here to receive live updates
    """
    user_id = current_user.id
    queue = await notification_manager.connect(user_id)
    
    async def event_generator():
        try:
            # Send initial connection message
            yield {
                "event": "connected",
                "data": json.dumps({
                    "message": "Connected to notification stream",
                    "user_id": user_id
                })
            }
            
            # Keep connection alive and send notifications
            while True:
                if await request.is_disconnected():
                    break
                
                try:
                    # Wait for notification with timeout
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield {
                        "event": "message",
                        "data": message
                    }
                except asyncio.TimeoutError:
                    # Send heartbeat every 30 seconds
                    yield {
                        "event": "ping",
                        "data": json.dumps({"timestamp": datetime.utcnow().isoformat()})
                    }
        finally:
            await notification_manager.disconnect(user_id, queue)
    
    return EventSourceResponse(event_generator())

async def notify_order_created(order_data: dict, user_id: str):
    """Notify when new order is created"""
    await notification_manager.broadcast_to_user(
        user_id,
        'order_created',
        {
            'order_id': order_data.get('id'),
            'order_number': order_data.get('order_number'),
            'customer_name': order_data.get('customer_info', {}).get('name'),
            'message': f"New order {order_data.get('order_number')} created"
        }
    )

async def notify_order_status_changed(order_data: dict, new_status: str, user_ids: list):
    """Notify when order status changes"""
    for user_id in user_ids:
        await notification_manager.broadcast_to_user(
            user_id,
            'order_status_changed',
            {
                'order_id': order_data.get('id'),
                'order_number': order_data.get('order_number'),
                'old_status': order_data.get('status'),
                'new_status': new_status,
                'message': f"Order {order_data.get('order_number')} status changed to {new_status}"
            }
        )

async def notify_payment_received(order_data: dict, payment_amount: float, user_ids: list):
    """Notify when payment is received"""
    for user_id in user_ids:
        await notification_manager.broadcast_to_user(
            user_id,
            'payment_received',
            {
                'order_id': order_data.get('id'),
                'order_number': order_data.get('order_number'),
                'amount': payment_amount,
                'message': f"Payment of ₹{payment_amount} received for {order_data.get('order_number')}"
            }
        )

async def notify_kitchen_new_order(order_data: dict):
    """Notify kitchen about new order"""
    # This would broadcast to all kitchen users
    # Implementation depends on how we track kitchen users
    pass
