# US Bakers - Bakery Management System

## Original problem statement
Clone https://github.com/k86791458-web/usbakersindia and make it run locally.

## Architecture
- Backend: FastAPI + MongoDB (motor) on port 8001 with `/api` prefix
- Frontend: React 19 + CRACO + Tailwind + Radix UI on port 3000
- Auth: JWT (python-jose) + passlib bcrypt
- Integrations referenced (not exercised here): MSG91 WhatsApp, PetPooja, Stripe, ReportLab PDFs

## What's been implemented (May 7, 2026)
- Full repo cloned into /app (backend, frontend, memory, tests)
- Backend deps installed via requirements.txt; frontend deps via yarn
- Existing /app .env files preserved (MONGO_URL, REACT_APP_BACKEND_URL)
- Supervisor restarted; both services running
- Auto-seeded super admin verified via /api/auth/login
- Login page renders correctly at preview URL

## Default credentials
See /app/memory/test_credentials.md

## Next Action Items / Backlog
- Run `python /app/backend/seed_data.py` if user wants sample outlets/zones/orders
- Configure MSG91 / PetPooja integrations (require auth keys)
- End-to-end QA via testing agent (not run in this session per user request)
