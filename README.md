# Abinet Connect

An international, role-based employment marketplace that connects employers, workers, and brokers through verified profiles, secure placement workflows, multilingual access, country-based administration, payments, compliance, and worker protection tools.

## What is included

- International-style dashboard application in `frontend/`
- Dependency-free Python backend API in `backend/app.py`
- Persistent JSON data store in `backend/data.json`
- Duplicate phone protection for registration
- Worker marketplace search and verification filters
- Employer job posting
- Broker placement tracking
- Admin verification queue
- Master Admin, Country Admin, Regional Manager, and officer permission model
- Staff-only job category management
- Staff application queue with shortlist, accept, and reject actions
- Multi-step public registration for employer, worker, and broker accounts
- Username/password registration for new public users
- Privacy, compliance, payment, and worker safety request forms
- Support ticket creation
- Audit log and platform analytics
- Static file serving from the same backend

## Run locally

```bash
python3 backend/app.py --port 8080
```

Then open:

```text
http://127.0.0.1:8080
```

If port `8080` is busy, choose another port:

```bash
python3 backend/app.py --port 8081
```

Private staff portal:

```text
http://127.0.0.1:8080/?staff=1#admin
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

## Hosting

Deployment templates and a VPS checklist are in `deploy/`.

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
- `GET /api/applications`
- `GET /api/notifications`
- `GET /api/compliance/requests`
- `GET /api/safety/reports`
- `GET /api/payments`
- `POST /api/auth/login`
- `POST /api/staff/register`
- `POST /api/job-categories`
- `POST /api/users/register`
- `POST /api/register`
- `POST /api/jobs`
- `POST /api/applications`
- `POST /api/placements`
- `POST /api/support/tickets`
- `POST /api/compliance/requests`
- `POST /api/safety/reports`
- `POST /api/payments`
- `PATCH /api/workers/{worker_id}/verify`
- `PATCH /api/jobs/{job_id}/status`
- `PATCH /api/applications/{application_id}/status`
- `PATCH /api/notifications/{notification_id}/read`
- `PATCH /api/users/{user_id}/profile`
