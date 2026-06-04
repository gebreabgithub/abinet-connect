# Abinet Connect Hosting Guide

Abinet Connect currently runs as one Python HTTP backend that serves the API and the frontend files. This is good for evaluation and a private pilot. For a public international launch, migrate the same product into PostgreSQL-backed services before real customer data is stored.

## VPS Deployment

1. Create a Linux server with Python 3.11 or newer.
2. Copy this project to `/opt/abinet-connect`.
3. Keep `backend/data.json` private and backed up.
4. Install the systemd service from `abinet-connect.service`.
5. Install the nginx site from `nginx.conf`.
6. Point your domain DNS to the server.
7. Add HTTPS with Certbot.

## Local Service

The service runs:

```bash
python3 backend/app.py
```

Default URL:

```text
http://127.0.0.1:8080
```

Private staff portal:

```text
https://your-domain.example/?staff=1#admin
```

## Production Checklist

- Move users, jobs, applications, payments, audit logs, and notifications from JSON into PostgreSQL.
- Add Redis for sessions, rate limiting, and queues.
- Store uploaded identity documents in private object storage.
- Add email/SMS verification, password reset, and multi-factor authentication for staff.
- Put secrets in environment variables, not source files.
- Enable daily database backups and off-server backup storage.
- Add monitoring, uptime checks, and error logs.
- Use a payment provider per country before accepting real payments.
- Run a legal review for privacy, employment, broker, and worker-protection rules in each launch country.

