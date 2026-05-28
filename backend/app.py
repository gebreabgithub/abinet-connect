from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import argparse
import copy
import hashlib
import json
import mimetypes
import os
import socket
import threading
import time
import uuid


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT / "frontend"
DATA_FILE = Path(__file__).with_name("data.json")
ROLES = {"Employer", "Worker", "Broker", "Manager", "MasterAdmin", "Support"}
STAFF_ROLES = {"Manager", "MasterAdmin"}
SESSIONS = {}


class Store:
    def __init__(self, path):
        self.path = path
        self.lock = threading.RLock()

    def read(self):
        with self.lock:
            with self.path.open("r", encoding="utf-8") as file:
                return json.load(file)

    def write(self, data):
        with self.lock:
            tmp = self.path.with_suffix(".tmp")
            with tmp.open("w", encoding="utf-8") as file:
                json.dump(data, file, indent=2)
                file.write("\n")
            tmp.replace(self.path)

    def update(self, mutator):
        with self.lock:
            data = self.read()
            result = mutator(data)
            self.write(data)
            return result


store = Store(DATA_FILE)


def now_ms():
    return int(time.time() * 1000)


def make_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def normalize_phone(value):
    return "".join(ch for ch in str(value or "") if ch.isdigit() or ch == "+")


def has_text(value, query):
    return str(query or "").lower() in str(value or "").lower()


def list_matches(items, query):
    query = str(query or "").lower()
    return any(query in str(item).lower() for item in items)


def parse_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value or "").split(",") if item.strip()]


def hash_password(password):
    return hashlib.sha256(str(password).encode("utf-8")).hexdigest()


def public_user(user):
    safe = dict(user)
    safe.pop("username", None)
    safe.pop("passwordHash", None)
    return safe


def public_bootstrap(data):
    return {
        "meta": data.get("meta", {}),
        "users": [public_user(user) for user in data.get("users", [])],
        "workers": data.get("workers", []),
        "jobs": data.get("jobs", []),
        "applications": [],
        "notifications": [],
        "jobCategories": data.get("jobCategories", []),
        "placements": data.get("placements", []),
        "brokers": data.get("brokers", []),
        "supportTickets": data.get("supportTickets", []),
        "fraudAlerts": data.get("fraudAlerts", []),
        "auditLog": data.get("auditLog", [])[-12:],
        "stats": build_stats(data),
    }


def build_stats(data):
    workers = data.get("workers", [])
    jobs = data.get("jobs", [])
    placements = data.get("placements", [])
    tickets = data.get("supportTickets", [])
    users = data.get("users", [])
    verified_workers = [worker for worker in workers if worker.get("verified")]
    active_jobs = [job for job in jobs if job.get("status") == "Open"]
    active_placements = [item for item in placements if item.get("status") not in {"Closed", "Cancelled"}]
    avg_rating = 0
    ratings = [float(worker.get("rating", 0)) for worker in workers if worker.get("rating")]
    if ratings:
        avg_rating = round(sum(ratings) / len(ratings), 2)
    return {
        "users": len(users),
        "workers": len(workers),
        "employers": len([user for user in users if user.get("role") == "Employer"]),
        "brokers": len(data.get("brokers", [])),
        "openJobs": len(active_jobs),
        "placements": len(placements),
        "activePlacements": len(active_placements),
        "verifiedWorkers": len(verified_workers),
        "verificationRate": round((len(verified_workers) / len(workers)) * 100) if workers else 0,
        "fraudAlerts": len(data.get("fraudAlerts", [])),
        "supportTickets": len(tickets),
        "openTickets": len([ticket for ticket in tickets if ticket.get("status") != "Closed"]),
        "averageRating": avg_rating,
        "applications": len(data.get("applications", [])),
        "unreadNotifications": len([item for item in data.get("notifications", []) if not item.get("read")]),
    }


def audit(data, actor, action, subject):
    data.setdefault("auditLog", []).insert(0, {
        "id": make_id("audit"),
        "at": now_ms(),
        "actor": actor,
        "action": action,
        "subject": subject,
    })
    data["auditLog"] = data["auditLog"][:80]


def notify(data, user_id, title, body, kind="info"):
    if not user_id:
        return
    data.setdefault("notifications", []).insert(0, {
        "id": make_id("note"),
        "userId": user_id,
        "title": title,
        "body": body,
        "kind": kind,
        "read": False,
        "createdAt": now_ms(),
    })
    data["notifications"] = data["notifications"][:120]


class ApiError(Exception):
    def __init__(self, message, status=400, details=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.details = details or {}


class BrokerHandler(BaseHTTPRequestHandler):
    server_version = "EthioBrokerEnterprise/1.0"

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Auth-Token, X-Admin-Token")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            route = parsed.path
            query = parse_qs(parsed.query)

            if route == "/api/health":
                return self.json({"status": "ok", "service": "Ethio Employment Broker", "version": "1.0"})
            if route == "/api/auth/session":
                user = self.require_session()
                return self.json({"status": "ok", "user": public_user(user)})
            if route == "/api/bootstrap":
                return self.json(public_bootstrap(store.read()))
            if route == "/api/admin/stats":
                return self.json(build_stats(store.read()))
            if route == "/api/users":
                return self.json(self.filter_users(query))
            if route == "/api/workers":
                return self.json(self.filter_workers(query))
            if route == "/api/jobs":
                return self.json(self.filter_jobs(query))
            if route == "/api/applications":
                user = self.require_session()
                return self.json(self.filter_applications(user, query))
            if route == "/api/notifications":
                user = self.require_session()
                return self.json(self.filter_notifications(user, query))
            if route == "/api/job-categories":
                return self.json(store.read().get("jobCategories", []))
            if route == "/api/placements":
                return self.json(store.read().get("placements", []))
            if route == "/api/brokers":
                return self.json(store.read().get("brokers", []))
            if route == "/api/support/tickets":
                return self.json(store.read().get("supportTickets", []))
            if route == "/api/admin/verification-queue":
                workers = [worker for worker in store.read().get("workers", []) if not worker.get("verified")]
                return self.json(workers)

            return self.static(route)
        except ApiError as error:
            return self.json({"error": error.message, **error.details}, error.status)
        except Exception as error:
            return self.json({"error": "Internal server error", "detail": str(error)}, 500)

    def do_POST(self):
        try:
            route = urlparse(self.path).path
            body = self.body()
            if route in {"/api/register", "/api/users/register"}:
                return self.json(self.register_user(body), 201)
            if route == "/api/auth/login":
                return self.json(self.login(body))
            if route == "/api/staff/register":
                self.require_master()
                return self.json(self.register_staff(body), 201)
            if route == "/api/jobs":
                return self.json(self.create_job(body), 201)
            if route == "/api/applications":
                user = self.require_session()
                return self.json(self.create_application(user, body), 201)
            if route == "/api/job-categories":
                self.require_staff()
                return self.json(self.create_category(body), 201)
            if route == "/api/placements":
                return self.json(self.create_placement(body), 201)
            if route == "/api/support/tickets":
                return self.json(self.create_ticket(body), 201)
            return self.json({"error": "Route not found"}, 404)
        except ApiError as error:
            return self.json({"error": error.message, **error.details}, error.status)
        except Exception as error:
            return self.json({"error": "Internal server error", "detail": str(error)}, 500)

    def do_PATCH(self):
        try:
            route = urlparse(self.path).path
            body = self.body()
            parts = [part for part in route.split("/") if part]
            if len(parts) == 4 and parts[:2] == ["api", "workers"] and parts[3] == "verify":
                self.require_staff()
                return self.json(self.verify_worker(parts[2], body))
            if len(parts) == 4 and parts[:2] == ["api", "jobs"] and parts[3] == "status":
                return self.json(self.update_job_status(parts[2], body))
            if len(parts) == 4 and parts[:2] == ["api", "applications"] and parts[3] == "status":
                self.require_staff()
                return self.json(self.update_application_status(parts[2], body))
            if len(parts) == 4 and parts[:2] == ["api", "notifications"] and parts[3] == "read":
                user = self.require_session()
                return self.json(self.mark_notification_read(user, parts[2]))
            if len(parts) == 4 and parts[:2] == ["api", "users"] and parts[3] == "profile":
                user = self.require_session()
                return self.json(self.update_profile(user, parts[2], body))
            return self.json({"error": "Route not found"}, 404)
        except ApiError as error:
            return self.json({"error": error.message, **error.details}, error.status)
        except Exception as error:
            return self.json({"error": "Internal server error", "detail": str(error)}, 500)

    def body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if not length:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        try:
            return json.loads(raw)
        except json.JSONDecodeError as error:
            raise ApiError("Invalid JSON body", 400, {"detail": str(error)})

    def json(self, payload, status=200):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def static(self, route):
        relative = route.lstrip("/") or "index.html"
        target = (FRONTEND_DIR / relative).resolve()
        if FRONTEND_DIR.resolve() not in target.parents and target != FRONTEND_DIR.resolve():
            return self.json({"error": "Forbidden"}, 403)
        if not target.exists() or target.is_dir():
            target = FRONTEND_DIR / "index.html"

        data = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store" if target.name.endswith((".html", ".js", ".css")) else "public, max-age=86400")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def filter_users(self, query):
        role = query.get("role", [""])[0]
        search = query.get("search", [""])[0]
        users = store.read().get("users", [])
        if role:
            users = [user for user in users if user.get("role") == role]
        if search:
            users = [user for user in users if has_text(user.get("name"), search) or has_text(user.get("phone"), search)]
        return [public_user(user) for user in users]

    def require_session(self):
        token = self.headers.get("X-Admin-Token", "") or self.headers.get("X-Auth-Token", "")
        user = SESSIONS.get(token)
        if not user:
            raise ApiError("Login required", 401)
        return user

    def require_staff(self):
        user = self.require_session()
        if user.get("role") not in STAFF_ROLES:
            raise ApiError("Manager or master admin login required", 403)
        return user

    def require_master(self):
        user = self.require_session()
        if user.get("role") != "MasterAdmin":
            raise ApiError("Master admin access required", 403)
        return user

    def login(self, body):
        username = str(body.get("username", "")).strip().lower()
        password = str(body.get("password", ""))
        for user in store.read().get("users", []):
            if str(user.get("username", "")).lower() == username:
                if user.get("passwordHash") == hash_password(password):
                    token = make_id("session")
                    SESSIONS[token] = user
                    return {"token": token, "user": public_user(user)}
        raise ApiError("Invalid username or password", 401)

    def filter_workers(self, query):
        skill = query.get("skill", [""])[0]
        location = query.get("location", [""])[0]
        verified = query.get("verified", [""])[0]
        workers = store.read().get("workers", [])
        if skill:
            workers = [worker for worker in workers if list_matches(worker.get("skills", []), skill)]
        if location:
            workers = [worker for worker in workers if has_text(worker.get("location"), location)]
        if verified in {"true", "false"}:
            workers = [worker for worker in workers if bool(worker.get("verified")) == (verified == "true")]
        return workers

    def filter_jobs(self, query):
        status = query.get("status", [""])[0]
        search = query.get("search", [""])[0]
        category = query.get("category", [""])[0]
        jobs = store.read().get("jobs", [])
        if status:
            jobs = [job for job in jobs if job.get("status") == status]
        if category:
            jobs = [job for job in jobs if job.get("category") == category]
        if search:
            jobs = [
                job for job in jobs
                if has_text(job.get("title"), search)
                or has_text(job.get("employer"), search)
                or has_text(job.get("location"), search)
            ]
        return jobs

    def filter_applications(self, user, query):
        data = store.read()
        user_id = query.get("userId", [""])[0]
        job_id = query.get("jobId", [""])[0]
        applications = data.get("applications", [])
        if user.get("role") not in STAFF_ROLES:
            user_id = user.get("id", "")
        if user_id:
            applications = [item for item in applications if item.get("workerId") == user_id or item.get("employerId") == user_id]
        if job_id:
            applications = [item for item in applications if item.get("jobId") == job_id]
        return applications

    def filter_notifications(self, user, query):
        user_id = query.get("userId", [""])[0]
        notifications = store.read().get("notifications", [])
        if user.get("role") not in STAFF_ROLES:
            user_id = user.get("id", "")
        if user_id:
            notifications = [item for item in notifications if item.get("userId") == user_id]
        return notifications

    def register_user(self, body):
        name = str(body.get("name", "")).strip()
        phone = normalize_phone(body.get("phone"))
        role = str(body.get("role", "")).strip().title()
        username = str(body.get("username", "")).strip().lower()
        password = str(body.get("password", ""))
        national_id = str(body.get("nationalId", "")).strip()
        if not name or not phone or role not in ROLES:
            raise ApiError("Name, phone, and a valid role are required", 400)
        if role in STAFF_ROLES:
            raise ApiError("Staff registration is restricted. Master admin approval is required.", 403)
        if not username or len(password) < 6:
            raise ApiError("Username and a password of at least 6 characters are required", 400)
        if role == "Employer" and not national_id:
            raise ApiError("National ID (FAN) is required for employers", 400)

        def mutate(data):
            for user in data.get("users", []):
                if normalize_phone(user.get("phone")) == phone and user.get("role") == role:
                    raise ApiError("A user with this phone and role already exists", 409, {"existingId": user.get("id")})
                if str(user.get("username", "")).lower() == username:
                    raise ApiError("This username is already taken", 409, {"existingId": user.get("id")})

            skills = parse_list(body.get("skills"))
            user = {
                "id": make_id("user"),
                "name": name,
                "phone": phone,
                "username": username,
                "passwordHash": hash_password(password),
                "role": role,
                "nationalId": national_id,
                "nationalIdStatus": "Submitted" if national_id else "Not provided",
                "address": str(body.get("address", "")).strip(),
                "city": str(body.get("city", "Addis Ababa")).strip() or "Addis Ababa",
                "country": str(body.get("country", "Ethiopia")).strip() or "Ethiopia",
                "language": str(body.get("language", "Amharic / English")).strip(),
                "status": "Active",
                "createdAt": now_ms(),
            }
            data.setdefault("users", []).append(user)

            if role == "Worker":
                worker = {
                    "id": user["id"],
                    "name": name,
                    "phone": phone,
                    "role": "Worker",
                    "location": user["address"] or user["city"],
                    "skills": skills,
                    "experience": str(body.get("experience", "New profile")).strip() or "New profile",
                    "salaryExpectation": str(body.get("salaryExpectation", "Negotiable")).strip() or "Negotiable",
                    "availability": str(body.get("availability", "Pending")).strip() or "Pending",
                    "rating": 0,
                    "verified": False,
                    "verificationStatus": "FAN submitted" if national_id else "Pending",
                    "nationalId": national_id,
                    "nationalIdStatus": "Submitted" if national_id else "Optional",
                    "riskLevel": "Normal",
                    "emergencyContact": str(body.get("emergencyContact", "")).strip(),
                    "completedJobs": 0,
                    "createdAt": user["createdAt"],
                }
                data.setdefault("workers", []).append(worker)

            audit(data, "System", "registered user", f"{name} ({role})")
            return public_user(user)

        return store.update(mutate)

    def register_staff(self, body):
        name = str(body.get("name", "")).strip()
        phone = normalize_phone(body.get("phone"))
        username = str(body.get("username", "")).strip().lower()
        password = str(body.get("password", ""))
        role = str(body.get("role", "Manager")).strip()
        if role not in {"Manager", "MasterAdmin"}:
            raise ApiError("Staff role must be Manager or MasterAdmin", 400)
        if not name or not phone or not username or len(password) < 6:
            raise ApiError("Staff name, phone, username, and a password of at least 6 characters are required", 400)

        def mutate(data):
            for user in data.get("users", []):
                if normalize_phone(user.get("phone")) == phone and user.get("role") in STAFF_ROLES:
                    raise ApiError("A staff user with this phone already exists", 409, {"existingId": user.get("id")})
                if str(user.get("username", "")).lower() == username:
                    raise ApiError("This username is already taken", 409, {"existingId": user.get("id")})

            user = {
                "id": make_id("user"),
                "name": name,
                "phone": phone,
                "username": username,
                "passwordHash": hash_password(password),
                "role": role,
                "address": str(body.get("address", "")).strip(),
                "city": str(body.get("city", "Addis Ababa")).strip() or "Addis Ababa",
                "country": str(body.get("country", "Ethiopia")).strip() or "Ethiopia",
                "language": str(body.get("language", "Amharic / English")).strip(),
                "status": "Active",
                "createdAt": now_ms(),
            }
            data.setdefault("users", []).append(user)
            audit(data, "Master Admin", "registered staff", f"{name} ({role})")
            return public_user(user)

        return store.update(mutate)

    def create_category(self, body):
        name = str(body.get("name", "")).strip()
        description = str(body.get("description", "")).strip()
        if not name:
            raise ApiError("Category name is required", 400)

        def mutate(data):
            categories = data.setdefault("jobCategories", [])
            for category in categories:
                if category.get("name", "").lower() == name.lower():
                    raise ApiError("This category already exists", 409, {"existingId": category.get("id")})
            category = {
                "id": make_id("cat"),
                "name": name,
                "description": description,
                "createdAt": now_ms(),
            }
            categories.append(category)
            audit(data, "Staff", "created job category", name)
            return category

        return store.update(mutate)

    def create_job(self, body):
        title = str(body.get("title", "")).strip()
        employer = str(body.get("employer", "")).strip()
        location = str(body.get("location", "")).strip()
        category = str(body.get("category", "General")).strip() or "General"
        if not title or not employer or not location:
            raise ApiError("Title, employer, and location are required", 400)

        def mutate(data):
            job = {
                "id": make_id("job"),
                "title": title,
                "employer": employer,
                "location": location,
                "category": category,
                "skills": parse_list(body.get("skills")),
                "salary": str(body.get("salary", "Negotiable")).strip() or "Negotiable",
                "schedule": str(body.get("schedule", "Flexible")).strip() or "Flexible",
                "status": "Open",
                "priority": str(body.get("priority", "Standard")).strip() or "Standard",
                "createdAt": now_ms(),
            }
            data.setdefault("jobs", []).insert(0, job)
            audit(data, "Employer Desk", "posted job", title)
            return job

        return store.update(mutate)

    def create_application(self, user, body):
        if user.get("role") != "Worker":
            raise ApiError("Only worker accounts can apply for jobs", 403)
        job_id = str(body.get("jobId", "")).strip()
        message = str(body.get("message", "")).strip()
        if not job_id:
            raise ApiError("Job id is required", 400)

        def mutate(data):
            job = next((item for item in data.get("jobs", []) if item.get("id") == job_id), None)
            if not job:
                raise ApiError("Job not found", 404)
            if job.get("status") not in {"Open", "Matched"}:
                raise ApiError("This job is not accepting applications", 400)
            for app in data.setdefault("applications", []):
                if app.get("jobId") == job_id and app.get("workerId") == user.get("id"):
                    raise ApiError("You already applied for this job", 409, {"existingId": app.get("id")})

            application = {
                "id": make_id("app"),
                "jobId": job_id,
                "jobTitle": job.get("title", ""),
                "workerId": user.get("id"),
                "workerName": user.get("name"),
                "employer": job.get("employer"),
                "employerId": job.get("employerId", ""),
                "message": message,
                "status": "Submitted",
                "createdAt": now_ms(),
            }
            data["applications"].insert(0, application)
            notify(data, user.get("id"), "Application submitted", f"You applied for {job.get('title')}.", "success")
            audit(data, "Worker Portal", "submitted application", f"{user.get('name')} -> {job.get('title')}")
            return application

        return store.update(mutate)

    def create_placement(self, body):
        worker = str(body.get("worker", "")).strip()
        employer = str(body.get("employer", "")).strip()
        broker = str(body.get("broker", "")).strip()
        if not worker or not employer or not broker:
            raise ApiError("Worker, employer, and broker are required", 400)

        def mutate(data):
            placement = {
                "id": make_id("placement"),
                "worker": worker,
                "employer": employer,
                "broker": broker,
                "commission": str(body.get("commission", "0 ETB")).strip() or "0 ETB",
                "status": str(body.get("status", "Scheduled")).strip() or "Scheduled",
                "startDate": str(body.get("startDate", "")).strip(),
                "createdAt": now_ms(),
            }
            data.setdefault("placements", []).insert(0, placement)
            audit(data, "Broker Desk", "created placement", f"{worker} to {employer}")
            return placement

        return store.update(mutate)

    def create_ticket(self, body):
        requester = str(body.get("requester", "")).strip()
        topic = str(body.get("topic", "")).strip()
        if not requester or not topic:
            raise ApiError("Requester and topic are required", 400)

        def mutate(data):
            ticket = {
                "id": make_id("ticket"),
                "requester": requester,
                "topic": topic,
                "priority": str(body.get("priority", "Medium")).strip() or "Medium",
                "status": "Open",
                "createdAt": now_ms(),
            }
            data.setdefault("supportTickets", []).insert(0, ticket)
            audit(data, "Support Desk", "opened ticket", topic)
            return ticket

        return store.update(mutate)

    def update_profile(self, user, target_id, body):
        if user.get("id") != target_id and user.get("role") not in STAFF_ROLES:
            raise ApiError("You can only update your own profile", 403)

        allowed = {"name", "address", "city", "language", "availability", "skills", "salaryExpectation", "experience", "emergencyContact", "nationalId"}

        def mutate(data):
            target = next((item for item in data.get("users", []) if item.get("id") == target_id), None)
            if not target:
                raise ApiError("User not found", 404)
            for key, value in body.items():
                if key in allowed:
                    target[key] = parse_list(value) if key == "skills" else str(value).strip()
            worker = next((item for item in data.get("workers", []) if item.get("id") == target_id), None)
            if worker:
                mapping = {
                    "name": "name",
                    "address": "location",
                    "availability": "availability",
                    "salaryExpectation": "salaryExpectation",
                    "experience": "experience",
                    "emergencyContact": "emergencyContact",
                    "nationalId": "nationalId",
                }
                for source, destination in mapping.items():
                    if source in body:
                        worker[destination] = str(body[source]).strip()
                if "skills" in body:
                    worker["skills"] = parse_list(body["skills"])
                if body.get("nationalId"):
                    worker["nationalIdStatus"] = "Submitted"
                    worker["verificationStatus"] = "FAN submitted"
            notify(data, target_id, "Profile updated", "Your account profile was updated.", "info")
            audit(data, "Account", "updated profile", target.get("name", target_id))
            return public_user(target)

        return store.update(mutate)

    def verify_worker(self, worker_id, body):
        def mutate(data):
            for worker in data.get("workers", []):
                if worker.get("id") == worker_id:
                    worker["verified"] = bool(body.get("verified", True))
                    worker["verificationStatus"] = "Verified" if worker["verified"] else "Rejected"
                    notify(data, worker_id, "Verification updated", f"Your verification status is {worker['verificationStatus']}.", "success" if worker["verified"] else "warning")
                    audit(data, "Staff", "updated verification", worker.get("name", worker_id))
                    return copy.deepcopy(worker)
            raise ApiError("Worker not found", 404)

        return store.update(mutate)

    def update_application_status(self, application_id, body):
        status = str(body.get("status", "")).strip()
        if status not in {"Submitted", "Shortlisted", "Accepted", "Rejected"}:
            raise ApiError("Invalid application status", 400)

        def mutate(data):
            for application in data.get("applications", []):
                if application.get("id") == application_id:
                    application["status"] = status
                    notify(data, application.get("workerId"), "Application updated", f"{application.get('jobTitle')} is now {status}.", "info")
                    audit(data, "Staff", "updated application", f"{application.get('workerName')} -> {application.get('jobTitle')}")
                    return copy.deepcopy(application)
            raise ApiError("Application not found", 404)

        return store.update(mutate)

    def mark_notification_read(self, user, notification_id):
        def mutate(data):
            for notification in data.get("notifications", []):
                if notification.get("id") == notification_id:
                    if notification.get("userId") != user.get("id") and user.get("role") not in STAFF_ROLES:
                        raise ApiError("Cannot update this notification", 403)
                    notification["read"] = True
                    return copy.deepcopy(notification)
            raise ApiError("Notification not found", 404)

        return store.update(mutate)

    def update_job_status(self, job_id, body):
        status = str(body.get("status", "")).strip()
        if status not in {"Open", "Matched", "Closed", "Cancelled"}:
            raise ApiError("Invalid job status", 400)

        def mutate(data):
            for job in data.get("jobs", []):
                if job.get("id") == job_id:
                    job["status"] = status
                    audit(data, "Employer Desk", "updated job status", job.get("title", job_id))
                    return copy.deepcopy(job)
            raise ApiError("Job not found", 404)

        return store.update(mutate)


def parse_args():
    parser = argparse.ArgumentParser(description="Run the Ethio Employment Broker backend")
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    return parser.parse_args()


def run():
    args = parse_args()
    try:
        server = ThreadingHTTPServer((args.host, args.port), BrokerHandler)
    except PermissionError as error:
        raise SystemExit(f"Could not start server on {args.host}:{args.port}. Try: python3 backend/app.py --port 8080\n{error}")
    except OSError as error:
        if error.errno in {48, 98}:
            raise SystemExit(f"Port {args.port} is already in use. Try: python3 backend/app.py --port 8080")
        raise

    print(f"Ethio Employment Broker running at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    socket.setdefaulttimeout(20)
    run()
