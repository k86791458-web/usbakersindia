# US Bakers - Bakery Management System

## Original problem statement
Clone https://github.com/k86791458-web/usbakersindia and make it run locally.
Then fix a list of feature/bug items reported by the user.

## Architecture
- Backend: FastAPI + MongoDB (motor) on port 8001 with `/api` prefix
- Frontend: React 19 + CRACO + Tailwind + Radix UI on port 3000
- Auth: JWT (python-jose) + passlib bcrypt

## Iteration log

### May 7, 2026 — Repo bring-up
- Cloned repo, installed deps, restarted supervisor — both services running
- Auto-seeded super admin verified (`admin@usbakers.com` / `admin123`)

### May 7, 2026 — Feature/bug fixes (this iteration)
**Backend (`/app/backend/server.py`)**
- HEIC/HEIF auto-conversion in `POST /api/upload-image` via `pillow_heif`
- Approval-based delete:
  - `DELETE /api/orders/{id}?reason=...` (reason required, super admin direct delete; others raise approval request)
  - `POST /api/orders/{id}/approve-delete`, `POST /api/orders/{id}/reject-delete`
  - `GET /api/orders/delete-requests`
  - New fields on Order: `delete_reason`, `delete_status`
- Buffer-time logic: `enrich_orders_with_kitchen_deadline` adds `kitchen_ready_deadline` and `ready_time_buffer_minutes` to `/api/kitchen/orders`
- New endpoints:
  - `GET /api/factory/production-sheet` (groups orders by base_size + flavour)
  - `GET /api/orders/time-slot-capacity` (returns `count`, `limit`, `exceeded`)
  - `POST /api/customers/import` (Excel-upload bulk customer import)
- `Order` / `OrderCreate` now have optional `base_size`
- `SystemSettings` exposes `max_orders_per_time_slot` (0 = unlimited)
- Order creation enforces the time-slot cap and returns 409 when full

**Frontend**
- `NewOrder.js`: Punch-order button stuck bug fixed (centralised `finishWithError` + try/finally always resets `submittingRef`); birthday split into Month/Day selects + optional YYYY; new "Base Size (Pounds)" field; HEIC accept; image picker now opens an editor before upload
- `components/ImageEditor.js` (new): Crop + pen-tool dialog using `react-image-crop`; emits a PNG blob to the upload handler
- `ManageOrders.js`: delete prompts for a reason; broken `/api/upload` → `/api/upload-image`; HEIC accept on edit
- `Customers.js`: Template / Export / Import Excel buttons (uses existing `xlsx` lib)
- `DeletedOrders.js`: Tabs for Deleted vs Pending Approvals (super-admin only) with Approve / Reject actions
- `Settings.js`: New `Max Orders per Delivery Time Slot` system setting

## Audit summary of user's request list
1. PDF download in Manage Orders — already present (HTML print + backend `/orders/download-pdf`)
2. Predefined flavours/occasions in edit — already present
3. Voice instruction in Manage Orders + Kitchen — already present
4. Excel up/down in Customers — **added in this iteration**
5. Navigation correction — **PENDING** (user said "as explained earlier"; details not shared in this session)
6. Edit image in edit order — fixed (broken endpoint + response key)
7. Multi-outlet user creation — already present (`outlet_scope` UI in UserManagementNew)
8. Delivery charges in total — already present
9. HEIC upload — **added in this iteration** (server-side conversion)
10. Punch order button stuck — **fixed in this iteration**
11. Crop / pen tool — **added in this iteration** (ImageEditor component)
12. Approval-based delete with reason — **added in this iteration**
13. Buffer-time — **added in this iteration** (kitchen_ready_deadline)
14. Orders timewise sort — already present
15. Default current date filter — already present
16. Time-clash management — **added in this iteration** (cap + 409 on overbook)
17. Base size on production sheet — **added in this iteration** (field + endpoint)
18. DOB year not mandatory — **added in this iteration** (Month/Day/optional Year)

## Backend test status
- 19/19 backend tests pass (testing agent iteration 1)
- File: `/app/backend/tests/test_iteration_backend_changes.py`

## Default credentials
See `/app/memory/test_credentials.md`.

## Next Action Items / Backlog
- Item 5 (navigation correction): need user to re-share what changes are required
- Item 11 (image editor): keep an eye on cross-browser pen-tool ergonomics on touch devices
- Wire production-sheet button into Factory/Kitchen UI (currently endpoint-only)
- MSG91 / PetPooja / Stripe credentials for live integrations
