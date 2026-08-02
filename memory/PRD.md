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
