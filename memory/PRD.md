# US Bakers India - Bakery Management System

## Original Problem Statement
Clone https://github.com/k86791458-web/usbakersindia.git into /app, then iterate on the following six fixes/features:
1. Delivery charges not included in total payment.
2. Order creation fails ("something went wrong") when `base_size` is left blank.
3. Smart-TV browsers see a "JavaScript required" / blank-page error.
4. Kitchen ready buffer time not working correctly.
5. Track every user action (create / edit / payment / etc.) in an activity log.
6. Replace MSG91 WhatsApp with **AiSensy** (POST https://backend.aisensy.com/campaign/t1/api/v2).

## Tech Stack
- **Backend**: FastAPI, Motor (Mongo), passlib/bcrypt, python-jose JWT, reportlab, pillow + pillow-heif, requests, emergentintegrations.
- **Frontend**: React 19, react-router-dom 7, TailwindCSS, Radix UI, lucide-react, recharts, xlsx.
- **DB**: MongoDB. Default DB: `usbakers_db`.

## Test Credentials
- Super Admin: `admin@usbakers.com` / `admin123` (auto-seeded). See `/app/memory/test_credentials.md`.

## Environment
- `/app/backend/.env`: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `SECRET_KEY`.
- `/app/frontend/.env`: `REACT_APP_BACKEND_URL`, `WDS_SOCKET_PORT=443`.

## Implemented (chronological)

### Iteration 1 — Initial clone (2026-01)
- Cloned repo into `/app`, preserved `.git` / `.emergent`.
- Created `.env` files & `uploads/` dir.
- Added missing deps: `reportlab`, `pillow`, `pillow-heif`.
- Verified app boots, login page loads.

### Iteration 2 — Six fixes (2026-01)

#### 1. Delivery charge bug
- `OrderCreate` model now declares `custom_delivery_charge: Optional[float] = 0.0`. Earlier this field was sent by the frontend but silently dropped by Pydantic, so totals never included custom delivery.
- `Order` constructor in `create_order` now passes `delivery_charge=delivery_charge` so it is persisted on the document, not only computed once.
- `NewOrder.js` Order Summary now displays the delivery charge for both preset and `custom` zones.

#### 2. Empty `base_size` → 422
- Added `@field_validator('size_pounds', 'base_size', 'custom_delivery_charge', mode='before')` in `OrderCreate` that coerces empty strings to `None`.
- `NewOrder.js` `handleSubmit` cleans the payload before POST as a belt-and-braces measure.

#### 3. Smart-TV "JavaScript required"
- `/app/frontend/public/index.html`:
  - Inline UA-detection script auto-redirects Tizen / WebOS / HbbTV / WebView TV browsers (and Chromium < 70) to `/tv-kitchen.html`.
  - `<noscript>` block now shows a prominent **Open Kitchen TV Display** button linking to `/tv-kitchen.html`.

#### 4. Kitchen buffer time
- `enrich_orders_with_kitchen_deadline()` now parses 4 time formats:
  1. `HH:MM` (24h)
  2. `HH:MM:SS` (24h with seconds)
  3. `h:MM AM/PM` (12h)
  4. `10:00 AM - 12:00 PM` (slot range → start time)

#### 5. Activity logs
- Existing `db.activity_logs` collection had no writers. Wired `create_activity_log(...)` into:
  - `login` — every successful login.
  - `create_order` — order creation (Punch or Hold).
  - `update_order` — captures changed fields with before / after snapshots.
  - `delete_order` — both direct delete (super admin) and approval-request paths.
  - `record_payment` — every payment.
- `ActivityLogs.js` (super-admin page) and `GET /api/activity-logs` were already in place — just needed the writers.

#### 6. AiSensy WhatsApp (replacing MSG91)
- New models: `AisensyConfig`, `AisensyConfigCreate`, `AisensyTemplate`, `AisensyTemplateCreate`.
- New endpoints (super admin only):
  - `GET /api/aisensy/config` — returns `api_key_masked` (never plaintext), `default_source`, `default_user_name`, `is_active`, `configured`.
  - `POST /api/aisensy/config` — save api_key + defaults.
  - `GET /api/aisensy/templates` — list per-event campaigns.
  - `POST /api/aisensy/templates` — upsert campaign mapping for an event with ordered `template_params` and `tags`.
  - `GET /api/aisensy/logs` — recent AiSensy send logs.
- New helpers in `server.py`:
  - `_normalize_phone_for_aisensy()` — coerces Indian numbers to `+91XXXXXXXXXX`.
  - `send_aisensy_whatsapp(order_id, event_type)` — POSTs to `https://backend.aisensy.com/campaign/t1/api/v2`, logs every attempt to `whatsapp_logs` with `provider="aisensy"`.
  - `send_whatsapp_notification(order_id, event_type)` — unified dispatcher: AiSensy first, MSG91 fallback. All 4 existing call sites now go through this.
- New page `/app/frontend/src/pages/AiSensySettings.js` at route `/aisensy-settings` with two tabs:
  - **API Configuration** — api key (write-only / masked), default source, default user name.
  - **Campaigns** — per-event campaign name + ordered `templateParams` selector + tags + enable switch.
- Sidebar (super admin): added **AiSensy WhatsApp** menu item.

### Iteration 5 — 2FA, Pending Payments, Custom Reports (2026-05-30)

#### 1. Google Authenticator (TOTP) 2FA for Super Admin
- **Backend** (`server.py` lines 934–1045): `/api/auth/2fa/status`, `/setup`, `/enable`, `/disable`, `/regenerate-backup-codes`. Login flow already supports challenge → verify step (`/auth/login` returns `requires_2fa=true` + `challenge_token`, `/auth/login/verify-2fa` completes login).
- **DB fields on `users`**: `is_two_factor_enabled`, `two_factor_secret`, `two_factor_backup_codes` (hashed).
- **Frontend** (`Settings.js`): new "Two-Factor Authentication" card visible only to super admin. Status badge (Enabled/Disabled) + remaining backup-codes counter. Four dialogs:
  - Setup: QR code (data URI) + manual base32 secret + 6-digit verify input.
  - Backup Codes (shown once): 8 codes + Copy + Download `.txt`.
  - Disable: password-confirm.
  - Regenerate: TOTP-confirm, invalidates old codes.
- **Login** (`Login.js`): already had 2FA challenge step (`step='2fa'`) — validated end-to-end with pyotp-minted codes.

#### 2. Pending Payments sub-tab
- `Payments.js`: All Payments / Pending Payments tabs with `payments-tab-all` / `payments-tab-pending`. Pending tab filters `pending_amount > 0`.
- **Fix:** Pagination block now uses `filteredPayments.length` (was `paymentsData.length` — caused wrong page count on Pending tab). Added `data-testid="payments-pagination-info|prev|next"`.

#### 3. Custom US Bakers Reports + Excel Export
- `Reports.js`: 4 report types (Sales Summary, Top Customers, Top Products, Outlet Performance). Date presets: Today, Last 7 days, Last 30 days, Current month, Custom. Default Top 10. Excel export via `xlsx` (filename embeds resolved date range).

## Testing
- Iteration 4: `/app/test_reports/iteration_4.json` (backend regression, 17/19 PASS).
- Iteration 5: `/app/test_reports/iteration_5.json` — frontend-only, **100% (12/12 sub-assertions PASS)** across all 7 review flows. Admin user left with 2FA disabled.

## Iteration 6 (2026-02) — Production deployment fixes + dust cleanup

### Prod deployment crash (502 on /api/auth/login) — RESOLVED
Root causes on VPS:
1. `/home/usbakers/usbakers-crm/backend/.env` missing → `KeyError: MONGO_URL` on startup.
2. `pyotp`, `qrcode` not installed in VPS venv (new 2FA deps).
3. `emergentintegrations==0.1.0` in `requirements.txt` blocked `pip install -r` on public PyPI.
4. `check_startup.py` did not call `load_dotenv()`, so it crashed even when `.env` existed.

Fixes:
- Removed `emergentintegrations` from `requirements.txt` (unused, Emergent-internal).
- Added `load_dotenv(Path(__file__).parent / ".env")` to `check_startup.py`.
- User created `.env` on VPS + ran `pip install -r requirements.txt`. **Login confirmed working.**

### Pending amount "dust" (₹0.10, ₹0.99) — FIXED
- Added `normalize_pending()` helper in `server.py`: rounds to 2 decimals; values with `abs(x) < ₹1` are treated as 0 (fully paid).
- Applied at all 9 sites where `pending_amount` is computed: discount apply, total edit, payment record, PetPooja sync (3 paths), reversals (2 paths), bill match.
- Frontend `Payments.js` Pending tab + counts + total now use `>= 1` threshold so dust orders disappear from the list.
- New one-time cleanup script: `/app/backend/cleanup_pending_dust.py` — sets `pending_amount = 0` for all orders where `0 < pending < ₹1` (also normalizes small negative dust).

## Iteration 7 (2026-02) — Group A: Order Lifecycle & Editing (P0)

### Completed (backend + frontend, tested green)
- **Occasion & Cake Size mandatory** — enforced in `NewOrder.js` for BOTH Punch and Hold order paths. Labels updated with `*` markers.
- **Super Admin can edit orders after Ready** — PATCH `/api/orders/{id}` now bypasses `is_ready` guard when caller is `super_admin`. Non-super roles get 400 "Cannot edit order after it's marked as ready. Contact Super Admin.".
- **Allowed-fields expanded (13 new)** — PATCH now accepts `receiver_info`, `delivery_address`, `delivery_city`, `zone_id`, `needs_delivery`, `outlet_id`, `order_taken_by`, `is_hold`, `lifecycle_status`, `status`, `delivery_charge`, `custom_delivery_charge`, `voice_instruction_url`. Response includes `changed_fields[]`. This also FIXES the "Hold order data not persisted" bug — hold orders released from `HoldOrders.js` no longer lose these fields silently.
- **Activity Log full diff** — every PATCH writes `before_data`/`after_data` snapshots to both `logs` and `activity_logs` collections.
- **Auto WhatsApp on order edit (AiSensy)** — new `WhatsAppTemplateEvent.ORDER_UPDATED` enum value. PATCH fires a `BackgroundTasks.add_task(send_whatsapp_notification, order_id, ORDER_UPDATED)`. Graceful: if AiSensy config missing, silently skips; PATCH still 200s.
- **Multiple reference images (up to 5) on Edit Order** — new "Reference Images" section in `ManageOrders.js` edit dialog with per-image remove buttons. Persists via existing `secondary_images` list.
- **Special Instructions supports newlines** — `Input` → `Textarea` (rows=4) in edit dialog. Enter key now inserts newline instead of submitting.
- **Deleted Orders enriched view** — records `deleted_from_status` + `deleted_from_lifecycle_status` at delete time (both direct super-admin delete and approved-request paths). `DeletedOrders.js` shows new columns: Flavour/Size, Delivery, Deleted From (badge), plus improved Reason wrapping. Backend `GET /orders/deleted` now joins user names → `delete_approved_by_name` / `delete_requested_by_name` / `deleted_by_name`.

### Tests
- `/app/backend/tests/test_iteration_6_order_lifecycle.py` — 19/19 PASS (backend Group A).
- Iteration 7 report — 8/8 PASS (frontend Group A).

## Iteration 8/9 (2026-02) — Group B: Delivery Flow Rework (P0) — COMPLETE

### Completed (backend 24/24 + frontend 8/8 tested green)
- **Cities settings**: `db.cities` collection + `/api/cities` CRUD (list / create / patch / delete). Super Admin only for writes. Case-insensitive duplicate check. Delete blocked if any active order references the city name.
- **₹50-multiple delivery-charge validation**: new `_validate_delivery_charge()` helper enforced in `POST /orders`, `PATCH /orders/{id}` (both `delivery_charge` and `custom_delivery_charge`), `POST /zones`, and `POST /orders/{id}/add-delivery`. `0` is always allowed (complementary).
- **Single "Upload Image" button** (`ManageOrders.js`): replaced the old separate purple "Upload" and cyan "Ready to Deliver" pair. Uses existing camera-capture flow which uploads the photo AND auto-transitions status to `ready_to_deliver`.
- **Add Delivery wizard** (`ManageOrders.js`): 4-step dialog (Zone → Charges → Receiver → Assign) opens for orders where `needs_delivery=false` and `status=ready_to_deliver`. New backend endpoint `POST /api/orders/{id}/add-delivery` supports zone / complementary / receiver / immediate-assign. Total & pending recalculated correctly.
- **Delivery city dropdown**: `NewOrder.js` delivery form and Add-Delivery wizard both pull city list from `/api/cities`. Falls back to free-text input in NewOrder if no cities are configured.
- **Customer OTP verification on delivery**: `DeliveryDashboard.js` "Delivered" CTA is now "Verify & Deliver" — opens a dedicated OTP dialog. Backend `POST /api/delivery/verify-otp` now guarded by `require_role([SUPER_ADMIN, DELIVERY])` AND requires order.status ∈ {picked_up, reached, ready_to_deliver} (fixes P0 security holes flagged by iter 8).
- **Receiver as primary contact**: `DeliveryDashboard.js` primary-contact card shows `receiver_info` name + phone with an orange "Receiver" badge when present; customer info is shown as a smaller secondary line below.
- **Delivery person full order details** — already returned by existing delivery endpoints; verified during iter 9 UI test.

### Tests
- `/app/backend/tests/test_iteration_8_delivery_flow.py` — 24/24 PASS.
- `/app/backend/tests/seed_iteration_9.py` — seed helper for frontend runs.
- Iteration 9 UI report — 8/8 scenarios PASS.

### Deferred / Optional hardening flagged by iter 8 (not blocking)
- `POST /orders/{id}/add-delivery`: validate `receiver_info` via `ReceiverInfo` Pydantic model.
- Return `assign_skipped_reason` when `assign_delivery_person_id` is provided but order isn't `ready_to_deliver`.
- `GET /api/cities?include_inactive=true` for reactivation UI.
- Store `city_id` (not name) on order to survive city rename.
- Client-side `%50` gate on the Add Delivery charge input for instant feedback.

## Group A — Still TO DO (deferred)
- Discount not reflecting in CRM totals (needs clarification: which screen shows wrong value? Current code DOES subtract discount from `total_amount`, so aggregates already exclude it. May need a separate "Discount Total" column in reports.)

## Group C — Global Filters (P1) — NEXT
- Global Outlet filter everywhere; login default = home outlet.
- Settings flavours appear in filters everywhere.
- Custom Flavour = ask user for name; goes into PDF + KOT.
- Manage Orders filter: pending payment > ₹1.
- Manage Orders show booking date column.
- Phone search returns ALL orders for that number.
- Full activity log description (untruncated).

## Backlog (P1/P2)
- **Refactor:** `ManageOrders.js` is now ~2,790 lines. Extract `AddDeliveryWizard.jsx`, `EditOrderDialog.jsx`, `AssignDeliveryDialog.jsx`.
- **Refactor:** `server.py` is ~6,910 lines. Split into `routers/cities.py`, `routers/delivery.py`, `routers/zones.py`, `routers/orders.py`, `routers/auth.py`, `routers/twofa.py`.
- **P2:** Sidebar brand-text overlap on the round logo — add `min-w-0 truncate`.
- **P2:** Capture IP + user-agent on the `login` activity log entry.
- **P2:** Seed orders with partial dues so Pending Payments pagination can be e2e re-verified.
- **P2:** `GET /api/activity-logs` should accept `entity_id` filter.
- **P2:** Add `GET /api/orders/{order_id}` — no direct fetch-by-id endpoint today.
- **P3:** Reference Images counter `{n}/5 uploaded` disappears when count=5; render outside conditional.
- **P3:** Status pill "Ready to Deliver" looks button-ish — style as clearly non-interactive.

## Next Action Items
- Run `python cleanup_pending_dust.py` on the VPS once to clean existing dust in prod.
- Configure AiSensy `order_updated` template + campaign so edit-order and add-delivery notifications actually fire (currently a no-op).
- Move on to **Group C — Global Filters** after user validates Group B on preview.
