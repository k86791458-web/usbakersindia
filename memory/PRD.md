# US Bakers India - PRD

## Original Problem Statement
Clone https://github.com/k86791458-web/usbakersindia.git into /app and get the app running as-is. Following that, incremental fixes on the running production CRM (deployed on Hostinger VPS at usbakers.tech). User pulls updates from git after each batch.

## App Overview
US Bakers – Bakery Management System (FastAPI + React + MongoDB).
Manages orders, outlets, kitchen workflow, deliveries, payments, PetPooja / WhatsApp (MSG91 & AiSensy) integrations, user roles, 2FA (TOTP) for Super Admin, incentives, reports, etc.

## Tech Stack
- Backend: FastAPI (uvicorn), Motor (MongoDB), passlib+bcrypt, python-jose (JWT), pyotp, qrcode, reportlab, pandas, openpyxl, pillow/pillow-heif
- Frontend: React 19 + CRA (craco) + Tailwind + Radix UI + react-router-dom v7
- DB: MongoDB (local in preview; production Mongo on Hostinger VPS)

## What's Implemented / Fixed So Far

### 2026-07-17 (session 1)
- Cloned repo content into `/app`; installed deps; supervisor running.
- Verified super admin login + JWT flow.

### 2026-07-17 (session 2 — Manage Orders visibility)
- Backend: Bumped `to_list(1000)` → `to_list(20000)` with sort `delivery_date DESC, created_at DESC` on ~18 order-list endpoints (manage, hold, pending, credit, deleted, kitchen, factory production sheet, factory orders, delivery available/my/all/summary, PDF, PetPooja orders, delete-requests, credit-pending) — fixes silent truncation across all outlets for Super Admin.
- Frontend (`ManageOrders.js`): default `dateFrom/dateTo = today` (IST-safe local date, not UTC); added Today / Tomorrow / Clear Dates quick buttons; added Outlet filter dropdown (default "All Outlets"); added outlet-name badge on each row; tab counters now respect outlet + date filters.

### 2026-08-02 (session 3 — Batch A quick fixes)
All 9 items PASS testing_agent (report /app/test_reports/iteration_10.json).
- a1: Activity Logs — removed `truncate` class; description shows fully with `whitespace-pre-wrap break-words`.
- a2: Edit Order Special Instructions — already a `<Textarea>`, verified newlines round-trip through backend PATCH.
- a3: Manage Orders — added `Booked: DD MMM YYYY` line under delivery date/time on every row.
- a4: KOT PetPooja Billing block — now prints `Outlet: <name>` on both single-print and bulk-print KOTs.
- a5: New Order form — customer name auto-formatted to Sentence Case (`toSentenceCase` utility).
- a6: Customers — Birthday cell now formatted "17 July 2007" (`formatBirthday`); added Age column (`ageFromBirthday`).
- a7: Deleted Orders — Export Excel button; deleted-from-stage badge already renders from `deleted_from_lifecycle_status`/`deleted_from_status`.
- a8: Customers — Sort by Pending H→L / L→H / Spent H→L / L→H / Name; filter by Gender + Age Min/Max.
- a9: Excel export on Hold / Pending / Credit / Deleted / Manage / Customers — comprehensive column set on Manage Orders (Booked On, Outlet, Order Taken By, receiver info, delivery info, all financial fields, timestamps, flags, PetPooja bill nos, etc.).
- New utilities: `/app/frontend/src/utils/formatters.js`, `/app/frontend/src/utils/excelExport.js`.

## Test Credentials (auto-seeded)
- Super Admin -> `admin@usbakers.com` / `admin123`

## Prioritized Backlog (P0/P1/P2 remaining)

### P0 — Reported production bugs (need repro from user)
- User rights still not working
- Unable to edit or delete user (Users page)
- Cake Image Report — default current date filter missing

### ✅ Completed — Batch B (order form + KOT/PDF) [2026-08-02]
- **b1** Delivery Time is a Select with 48 half-hour slots (`00:00 / 00:30 / … / 23:30`) shown as 12-hour labels. Applied to both New Order and Edit Order.
- **b2** Custom Flavour option in Flavour Select; free-text name propagates to order, KOT, PDF, list.
- **b3** Flavours ### P1 — Batch B (order form + KOT/PDF) Occasions dropdowns in Manage Orders + shared OrderFilters wired to `/api/flavours` and `/api/occasions`. Startup seed adds 10 flavours + 10 occasions if collections empty.
- **b4** KOT payment block re-laid out: Cake Amount / Delivery Amount / (Discount) / Total / Paid / Balance, with "COMPLEMENTARY" label when applicable.
- **b5** Kitchen READY BY row on KOT (single + bulk) = delivery_time − outlet.ready_time_buffer_minutes (defaults to 0 when unset).
- **b6** Occasion + Cake size (pounds) mandatory in NewOrder for punch and hold — verified.
- **b7** Discount badge added on Manage Orders row + Discount row in KOT PAYMENT block when >0.
- **b8** WhatsApp ORDER_UPDATED template fires on PATCH — verified.

Pytest: `/app/backend/tests/test_batch_b.py` (6/6 pass). Testing report: `/app/test_reports/iteration_11.json`.

### P1 — Batch B (order form + KOT/PDF)
- 30-min slot enforcement on delivery time
- Custom flavour entry (freeform) → propagates to KOT/PDF/list
- Flavours & Occasions dropdowns pulled from Settings in **every** filter
- KOT payment block: Cake / Delivery / Total / Paid / Balance (Balance="Complementary" if delivery complementary)
- Delivery time on PDF/KOT minus outlet buffer (buffer already stored, wire it)
- Discount applied → reflected in Manage Orders card + KOT + PDF
- Verify WhatsApp on order edit payload

### P1 — Batch C (Kitchen + Delivery)
- Kitchen right-sidebar separate "Ready Orders" tab
- Kitchen displays next-day at exactly 12:00 AM (job/logic)
- POS/LED browser fallback
- Receiver info as PRIMARY to delivery person
- Merge "Upload Photo" + "Ready to Deliver" into single Upload Image button
- Manual "Send both cake photos to customer" button (date default = today)

### P1 — Batch D (Credit/Complementary/Payment)
- Credit paid → auto-move to Manage; complementary → Complementary tab (new)
- Payment restricted unless order transferred to another outlet
- Bill re-sync flag if order edited
- PetPooja Sync View All → only unsynced custom cakes with outlet name
- C16 short-code detection + separate view

### P2 — Batch E (Reports/Auth/Analytics)
- Delivery Person feedback report
- Activity logs: current user only + auto-purge > 30 days
- Trusted-device 2FA
- Granular roles audit
- Incentive report filters
- Emergent LLM key for analytics Q&A
- 12-hour time format sweep everywhere
- Multi-outlet zone

### P2 — Batch F (large scope)
- Old CRM SQL import (with photos)
- Public order form
- Mobile responsiveness audit
- Global Outlet selector in top nav
- New-device 2FA with device fingerprint

## Deployment Notes for User
1. Click "Save to GitHub" in Emergent toolbar to push updates to `github.com/k86791458-web/usbakersindia`.
2. On Hostinger VPS:
   ```bash
   cd /path/to/usbakersindia
   git pull origin main
   sudo systemctl restart usbakers-backend        # or supervisorctl restart backend
   cd frontend && yarn install && yarn build && sudo systemctl reload nginx
   ```

## 2026-10-14 — AiSensy WhatsApp go-live + Object Storage
- Uploads (cake images, voice) moved to Emergent Object Storage (`backend/storage.py`); `/api/uploads/{path}` serves local legacy files first, then object storage.
- AiSensy key saved; 4 campaigns mapped: order_placed→crm_order_confirm (12 params), order_updated→crm_order_updated (7), delivered→crm_order_feedback (3), birthday→crm_birthday (1).
- New param keys: size, name_on_cake, delivery_type, delivery_address, receiver_name, delivery_otp, cake_image_url, actual_cake_image_url (absolute via PUBLIC_BASE_URL). Dates dd-mm-yyyy, time 12h.
- Birthday: daily cron `.emergent/crons.yml` 00:00 IST → POST /api/cron/birthday-wishes (WEBHOOK_CRON_SECRET), dedupe in `birthday_wishes_sent`; manual POST /api/aisensy/birthday/run-now (super admin).
- Smoke test to 8968333413 (2026-10-14, after user created API campaigns): all 4 campaigns accepted by AiSensy (success=true).
- Pending: 3 bugs (user rights, edit/delete user, cake image report default date), Batch E e1/e3/e4/e7, testing agent for Batch E.

## 2026-10-14 — User rights, user edit/delete, Batch E completion (tested: iteration_14.json, 100% pass)
- Page-level permissions (`pages` group, page_*). The ticked rights decide which menus/pages a user sees; role only seeds defaults (ROLE_DEFAULT_PAGES). Startup migration added defaults to existing users/templates.
- Backend `require_role` also grants access via mapped permissions (`_ROUTE_PERM_RULES`).
- PUT /api/users/{id} (edit details/role/outlets, optional reset perms to role); Users page Edit + Delete buttons; Factory Manager role option.
- Delivery Person Report: GET /api/reports/delivery-persons + /delivery-report page (no ratings, per user).
- Trusted-device 2FA: remember device 30 days (device_token), super admin Trusted Devices card in Settings with Remove.
- 12-hour time everywhere (order lists, kitchen, factory, delivery, PDFs/KOT, Excel exports, activity logs).
- Cake Image Report defaults to today's date.
- Sidebar brand overlap fixed.
- Backlog (Batch F): Old CRM SQL import, public order form, mobile audit, global outlet selector; AiSensy rating replies into CRM.

## 2026-10-19 — Blank screen for non-admin logins (VPS) fixed
- Root cause: logged-in user with no page_* rights -> firstAllowedPath returned '/login' -> /login redirected to itself (infinite redirect, blank page). Happens when backend wasn't restarted/migrated or role has no defaults.
- Fix: frontend falls back to role default pages when user has no page_* rights (utils/pagePermissions.js); users with zero allowed pages go to /no-access page with Logout.
- VPS notes: restart backend after pull (runs page-rights migration); .env needs EMERGENT_LLM_KEY (object storage + analytics), WEBHOOK_CRON_SECRET, PUBLIC_BASE_URL; birthday cron must be a VPS crontab hitting POST /api/cron/birthday-wishes at 00:00 IST.
- Pending: KOT footer branch-name bug — waiting for user's KOT photo.

## 2026-10-19 — AiSensy defaults seeded from code
- AISENSY_API_KEY in backend/.env; startup `seed_aisensy_defaults` creates config + 4 templates only if missing (AISENSY_DEFAULT_TEMPLATES): crm_order_confirm_final (12), crm_order_updated_final (9: +name_on_cake, size), crm_order_feedback (3), crm_birthday (1).
- Smoke test 8968333413: feedback + birthday sent; *_final campaigns return "Campaign does not exist" -> user must create AiSensy API campaigns with exactly those names (Live).
- 2026-10-19: AiSensy key hardcoded in server.py (AISENSY_DEFAULT_API_KEY, env AISENSY_API_KEY overrides) per owner request. Legacy campaign names auto-renamed to *_final on startup. crm_order_updated_final live campaign accepts 7 params only (9 rejected) -> seeded with 7. All 4 campaigns verified sent to 8968333413.
- 2026-10-20: Image/voice upload broke on self-hosted VPS (object storage needs EMERGENT_LLM_KEY, not in git). Added `save_upload` fallback: cloud storage when available, else local backend/uploads/. Both paths verified (200 on serve).
