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

## Testing
- `/app/backend/tests/test_iteration_4_fixes.py` — 19 targeted tests (17 PASS / 2 skipped due to missing non-admin seeds).
- `/app/backend/tests/test_usbakers_backend.py` — pre-existing 43-test regression.
- See `/app/test_reports/iteration_4.json` for the full report.

## Backlog (P1/P2)
- **P2 (carry-over):** Sidebar brand-text overlap on the round logo at wide widths — add `min-w-0 truncate` to the title span.
- **P2:** `server.py` is ~6,000 lines — split into routers (auth, orders, kitchen, delivery, payments, aisensy, activity, settings).
- **P2:** Capture IP + user-agent on the `login` activity log entry.
- **P2:** Seed `kitchen@`, `outlet@`, etc. credentials so RBAC tests cover all 7 roles.
- **P2:** Add a single-resource `GET /api/orders/{order_id}` endpoint.
- **P3:** Mask AiSensy api_key with dynamic length (cosmetic).

## Next Action Items
- Get AiSensy template/campaign names from the AiSensy dashboard and configure them in the new **AiSensy WhatsApp → Campaigns** tab so notifications actually fire.
- Review the broader bug-fix backlog already documented in the repo (`SCALING_ROADMAP.md`, `IMPROVEMENTS_RECOMMENDED.md`, `BUG_FIXES_PLAN.md`).
