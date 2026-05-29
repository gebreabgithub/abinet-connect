# EthioWork Exchange

A stable local foundation for an employment broker platform in Ethiopia. It connects employers, workers, brokers/agencies, admins, and support teams through identity intake, worker discovery, job demand, placement operations, trust verification, support tickets, audit activity, and analytics.

## What is included

- International-style dashboard application in `frontend/`
- Dependency-free Python backend API in `backend/app.py`
- Persistent JSON data store in `backend/data.json`
- Duplicate phone protection for registration
- Worker marketplace search and verification filters
- Employer job posting
- Broker placement tracking
- Admin verification queue
- Master Admin and Manager permission model
- Staff-only job category management
- Username/password registration for new public users
- Support ticket creation
- Audit log and platform analytics
- Static file serving from the same backend

## Run locally

```bash
python3 backend/app.py
```

Then open:

```text
http://localhost:8000
```

If port `8000` is busy:

```bash
python3 backend/app.py --port 8080
```

## Android installable app

This project now includes a Progressive Web App setup:

- `frontend/manifest.webmanifest`
- `frontend/service-worker.js`
- `frontend/assets/icon.svg`

To install on Android:

1. Run the backend on a phone-accessible host, not only `127.0.0.1`.
2. Open the site in Android Chrome.
3. Tap the Chrome menu.
4. Tap **Add to Home screen** or **Install app**.

For local network testing from a phone:

```bash
python3 backend/app.py --host 0.0.0.0 --port 8080
```

Then open this from the Android phone, replacing the IP with the computer IP:

```text
http://YOUR_COMPUTER_IP:8080
```

For a real Play Store APK later, wrap this web app with Capacitor or rebuild the client in native Android/Kotlin and connect it to the same backend API.

## Suggested production stack

The PDF recommends:

- Frontend: React + Tailwind CSS
- Backend: FastAPI
- Database: PostgreSQL
- Authentication: Phone verification
- Deployment: VPS or local cloud server

This version avoids external dependencies so it can run immediately from this folder. The API routes and data model are intentionally shaped so they can be moved to FastAPI and PostgreSQL without changing the product flow.

## API routes

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/users`
- `GET /api/workers`
- `GET /api/jobs`
- `GET /api/placements`
- `GET /api/brokers`
- `GET /api/admin/stats`
- `GET /api/admin/verification-queue`
- `GET /api/support/tickets`
- `GET /api/job-categories`
- `POST /api/auth/login`
- `POST /api/staff/register`
- `POST /api/job-categories`
- `POST /api/users/register`
- `POST /api/register`
- `POST /api/jobs`
- `POST /api/placements`
- `POST /api/support/tickets`
- `PATCH /api/workers/{worker_id}/verify`
- `PATCH /api/jobs/{job_id}/status`
