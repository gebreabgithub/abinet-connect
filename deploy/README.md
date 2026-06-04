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
8. Install the backup service and timer from `abinet-connect-backup.service` and `abinet-connect-backup.timer`.

## Local Service

The service runs locally behind nginx:

```bash
python3 backend/app.py --host 127.0.0.1 --port 8080
```

Default URL:

```text
http://127.0.0.1:8080
```

The included systemd template uses the same host and port, and the included nginx template proxies public traffic to that backend.

Private staff portal:

```text
https://your-domain.example/?staff=1#admin
```

## Production Checklist

- Move users, jobs, applications, payments, audit logs, and notifications from JSON into PostgreSQL.
- Add Redis for sessions, rate limiting, and queues.
- Store uploaded identity documents in private object storage.
- Add email/SMS verification and production password reset delivery.
- Enable staff MFA in `abinet-connect.service` by setting `STAFF_MFA_REQUIRED=1` and `STAFF_MFA_CODE`.
- Put secrets in environment variables, not source files.
- Enable daily backups using the included backup timer, then copy backups off-server.
- Add monitoring, uptime checks, and error logs.
- Use a payment provider per country before accepting real payments.
- Run a legal review for privacy, employment, broker, and worker-protection rules in each launch country.

## Backup Setup

Copy these files to systemd:

```bash
sudo cp deploy/abinet-connect-backup.service /etc/systemd/system/
sudo cp deploy/abinet-connect-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now abinet-connect-backup.timer
```

Backups are written to:

```text
/var/backups/abinet-connect
```

Keep an off-server copy as well. Local backups alone do not protect against server loss.

## HTTPS Setup

After DNS points to the server and nginx is installed:

```bash
sudo certbot --nginx -d your-domain.example -d www.your-domain.example
```

Do not collect real identity documents or payments before HTTPS is active.
