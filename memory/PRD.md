# US Bakers India - Bakery Order Management System

## Original Problem Statement
Clone the full-stack Bakery Order Management application from `k86791458-web/usbakersindia` GitHub repository, get it running, and:
- Fix bugs (order saving, TV kitchen display, responsiveness)
- Add Activity Logs (every action across roles must be logged)
- Add Real-time Notifications
- Add Advanced Search & Filtering everywhere meaningful
- Improve security and scale the application
- Ensure database presets (flavours, occasions, time slots) are populated

## Tech Stack
- **Frontend**: React, TailwindCSS, Shadcn UI, React Router, Context API
- **Backend**: FastAPI, Motor (async MongoDB), sse-starlette, Pydantic
- **Database**: MongoDB
- **Real-time**: Server-Sent Events (SSE) / WebSockets

## Key Architecture
- `/app/frontend/src/pages/` - main views (`NewOrder.js`, `ActivityLogs.js`, `ManageOrders.js`, etc.)
- `/app/frontend/src/components/` - shared components (`LayoutWithSidebar`, `OrderFilters`)
- `/app/backend/server.py` - main FastAPI server (5700+ lines)
- `/app/backend/notifications.py` - real-time notifications module
- `/app/backend/security.py` - security helpers

## Critical Constraints
- `starlette==0.37.2` is pinned for sse-starlette compatibility — DO NOT upgrade
- All backend routes must be `/api/...` prefixed
- Use `MONGO_URL`, `DB_NAME` from `backend/.env`; `REACT_APP_BACKEND_URL` from `frontend/.env`

## Test Credentials (Super Admin)
Email: `admin@usbakers.com`
Password: `admin123`
Role: `super_admin`

## Completed Work

### Initial Build (prior sessions)
- Repository cloned and running
- `base_size` schema validation error fixed for order creation
- Kitchen display JavaScript warning fixed + responsive CSS
- Activity Logs (backend + frontend)
- Real-time Notifications (SSE + WebSockets)
- Advanced Search & Filtering across order management pages
- `admin@usbakers.com` Super Admin user created
- Login starlette dependency conflict resolved
- Default presets seeded (Flavours: 18, Occasions: 20, Time slots: 7)

### Feb 9, 2026 Session
- ✅ **Gender dropdown red border on initial load** — Fixed `/app/frontend/src/pages/NewOrder.js` to use `submitAttempted` state. Red border + "Gender is required" message now appear only AFTER the user attempts submit, not on initial page load.
- ✅ **Re-seeded missing presets** — Database lost preset data (flavours/occasions/time-slots all 0). Re-populated via API: 18 flavours, 20 occasions, 7 time slots. The "Some presets didn't load" warning is gone.

## Current Status
- All previously reported P0 bugs resolved.
- App is running and stable.
- No pending issues from user.

## Backlog / Future Tasks
- **Refactor `NewOrder.js`** (1153 lines) into sub-components (CustomerInfoForm, OrderItemsForm, DeliveryForm)
- **Idempotent preset seeding** — Currently presets must be manually re-seeded if cleared. Add startup seed script to ensure they're always present.
- **Audit other validation fields** for the same "red on load" anti-pattern (currently only gender was reported)
- Items from `/app/SCALING_ROADMAP.md`

## Key API Endpoints
- `POST /api/auth/login` — Authentication (returns access_token)
- `POST /api/orders` — Order creation
- `GET /api/orders` — Order listing
- `GET /api/whatsapp/logs` — Activity logs
- `GET/POST /api/flavours` — Cake flavours
- `GET/POST /api/occasions` — Occasions
- `GET/POST /api/time-slots` — Delivery time slots

## Key DB Collections
- `users` — {email, password, role, is_active, created_at}
- `orders` — {id, customer_info, items, total_amount, status}
- `activity_logs` — {id, order_id, action, user, timestamp, details}
- `cake_flavours`, `occasions`, `delivery_time_slots` — presets
