# US Bakers India - PRD

## Original Problem Statement
Clone https://github.com/k86791458-web/usbakersindia.git into /app and get the app running as-is without removing anything from the repo. User will make changes after it is running.

## App Overview
US Bakers – Bakery Management System (FastAPI + React + MongoDB).
Manages orders, outlets, kitchen workflow, deliveries, payments, PetPooja / WhatsApp (MSG91 & AiSensy) integrations, user roles, 2FA (TOTP) for Super Admin, incentives, reports, etc.

## Tech Stack
- Backend: FastAPI (uvicorn), Motor (MongoDB), passlib+bcrypt, python-jose (JWT), pyotp, qrcode, reportlab, pandas, openpyxl, pillow/pillow-heif
- Frontend: React 19 + CRA (craco) + Tailwind + Radix UI + react-router-dom v7
- DB: MongoDB (local)

## Setup Done (2026-07-17)
- Cloned repo content into `/app` (preserved existing `.git`, restored original `backend/.env`, `frontend/.env`, `.emergent/emergent.yml`)
- Installed backend dependencies from `backend/requirements.txt`
- Installed frontend dependencies via `yarn install`
- Restarted supervisor: backend + frontend both RUNNING
- Verified: login endpoint returns 200 and issues JWT; frontend login page loads correctly at the preview URL

## Test Credentials (auto-seeded by backend on startup)
- Super Admin -> Email: `admin@usbakers.com` / Password: `admin123`

## Next Action Items
- Await user's specific change requests (feature additions, bug fixes, UI tweaks)
