const state = {
  users: [],
  workers: [],
  jobs: [],
  placements: [],
  brokers: [],
  supportTickets: [],
  fraudAlerts: [],
  auditLog: [],
  jobCategories: [],
  applications: [],
  notifications: [],
  stats: {},
  selectedRole: "employer",
  adminToken: readStoredAdminToken(),
  currentUser: null,
  publicToken: readStoredPublicToken(),
  publicUser: readStoredPublicUser(),
};

const metricLabels = [
  ["workers", "Workers"],
  ["verifiedWorkers", "Verified"],
  ["openJobs", "Open jobs"],
  ["activePlacements", "Active placements"],
  ["openTickets", "Open tickets"],
  ["verificationRate", "Verification"],
  ["averageRating", "Avg rating"],
  ["fraudAlerts", "Risk alerts"],
];

const heroMetrics = [
  ["users", "registered identities"],
  ["brokers", "broker partners"],
  ["employers", "employer accounts"],
];

const pageTitles = {
  overview: "Choose your role",
  admin: "Admin access",
  employer: "I need workers",
  employee: "I need a job",
  broker: "Broker workspace",
  support: "Support",
};

const roleExperiences = {
  employer: {
    eyebrow: "Employer experience",
    title: "Hire faster with verified worker discovery.",
    intro: "Designed for families, restaurants, offices, and companies that need trusted workers.",
    actions: ["Post Jobs", "Find Workers", "Verified Workers"],
    statKeys: [["openJobs", "open jobs"], ["verifiedWorkers", "verified workers"], ["averageRating", "average rating"]],
    target: "employer",
    cta: "Open Employer Workspace",
  },
  employee: {
    eyebrow: "Worker experience",
    title: "Find work and build a trusted profile.",
    intro: "Workers can track readiness, visibility, reputation, and verification from one place.",
    actions: ["Available Jobs", "Complete Profile", "Verification Status"],
    statKeys: [["openJobs", "available jobs"], ["verificationRate", "verification rate"], ["averageRating", "average rating"]],
    target: "employee",
    cta: "Open Worker Workspace",
  },
  broker: {
    eyebrow: "Broker experience",
    title: "Manage placements, workers, and commissions.",
    intro: "Agencies and local brokers can coordinate assignments while keeping trust signals visible.",
    actions: ["Register Workers", "Assign Placements", "Track Commissions"],
    statKeys: [["brokers", "broker partners"], ["activePlacements", "active placements"], ["workers", "worker profiles"]],
    target: "broker",
    cta: "Open Broker Workspace",
  },
};

function getSessionStorage() {
  try {
    return window.sessionStorage || null;
  } catch {
    return null;
  }
}

function readStoredAdminToken() {
  const storage = getSessionStorage();
  return storage ? storage.getItem("abinetAdminToken") || "" : "";
}

function readStoredPublicToken() {
  const storage = getSessionStorage();
  return storage ? storage.getItem("abinetPublicToken") || "" : "";
}

function readStoredPublicUser() {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem("abinetPublicUser") || "null");
  } catch {
    return null;
  }
}

function writeStoredPublicSession(token, user) {
  const storage = getSessionStorage();
  if (storage) {
    storage.setItem("abinetPublicToken", token);
    storage.setItem("abinetPublicUser", JSON.stringify(user));
  }
}

function removeStoredPublicSession() {
  const storage = getSessionStorage();
  if (storage) {
    storage.removeItem("abinetPublicToken");
    storage.removeItem("abinetPublicUser");
  }
}

function writeStoredAdminToken(token) {
  const storage = getSessionStorage();
  if (storage) {
    storage.setItem("abinetAdminToken", token);
  }
}

function removeStoredAdminToken() {
  const storage = getSessionStorage();
  if (storage) {
    storage.removeItem("abinetAdminToken");
  }
}

function qs(selector) {
  return document.querySelector(selector);
}

function splitList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload.error || "Request failed";
    throw new Error(message);
  }
  return payload;
}

function clearAdminSession() {
  state.adminToken = "";
  removeStoredAdminToken();
  updateAdminGate();
}

async function validateAdminSession() {
  if (!state.adminToken) return;
  const response = await fetch("/api/auth/session", {
    headers: { "X-Admin-Token": state.adminToken },
  });
  if (!response.ok) {
    clearAdminSession();
    return;
  }
  const payload = await response.json();
  state.currentUser = payload.user;
}

async function loadAccountData() {
  if (!state.publicToken || !state.publicUser) {
    state.applications = [];
    state.notifications = [];
    return;
  }
  const headers = { "X-Auth-Token": state.publicToken };
  try {
    const [applications, notifications] = await Promise.all([
      request(`/api/applications?userId=${encodeURIComponent(state.publicUser.id)}`, { headers }),
      request(`/api/notifications?userId=${encodeURIComponent(state.publicUser.id)}`, { headers }),
    ]);
    state.applications = applications;
    state.notifications = notifications;
  } catch {
    state.publicToken = "";
    state.publicUser = null;
    removeStoredPublicSession();
    state.applications = [];
    state.notifications = [];
  }
}

function toast(message, type = "success") {
  const element = qs("#toast");
  element.textContent = message;
  element.dataset.type = type;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 3000);
}

function formatMetric(key, value) {
  if (key === "verificationRate") return `${value || 0}%`;
  if (key === "averageRating") return value ? Number(value).toFixed(2) : "0.00";
  return value ?? 0;
}

function timeAgo(ms) {
  if (!ms) return "Recently";
  const minutes = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function renderMetrics() {
  qs("#metricGrid").innerHTML = metricLabels.map(([key, label]) => `
    <article class="metric-card">
      <span>${label}</span>
      <strong>${formatMetric(key, state.stats[key])}</strong>
    </article>
  `).join("");

  qs("#heroMetrics").innerHTML = heroMetrics.map(([key, label]) => `
    <article>
      <strong>${state.stats[key] ?? 0}</strong>
      <span>${label}</span>
    </article>
  `).join("");

  qs("#adminMetrics").innerHTML = [
    ["verificationRate", "Verification"],
    ["fraudAlerts", "Risk alerts"],
    ["openTickets", "Open tickets"],
    ["users", "Users"],
  ].map(([key, label]) => `
    <article class="metric-card">
      <span>${label}</span>
      <strong>${formatMetric(key, state.stats[key])}</strong>
    </article>
  `).join("");

  qs("#openJobsCount").textContent = `${state.stats.openJobs || 0} open`;
  renderCategoryOptions();
}

function renderCategoryOptions() {
  const select = qs("#jobCategorySelect");
  if (!select) return;
  select.innerHTML = (state.jobCategories || []).map((category) => `
    <option>${escapeHtml(category.name)}</option>
  `).join("") || `<option>General</option>`;
}

function updateNationalIdRequirement() {
  const roleSelect = qs("#registerForm select[name='role']");
  const nationalId = qs("#nationalIdInput");
  const hint = qs("#nationalIdHint");
  if (!roleSelect || !nationalId || !hint) return;
  const employer = roleSelect.value === "Employer";
  nationalId.required = employer;
  nationalId.placeholder = employer
    ? "Required National ID / FAN"
    : "Optional National ID / FAN";
  hint.textContent = employer
    ? "National ID (FAN) is required for employer accounts."
    : "National ID (FAN) is optional for workers and other public users.";
}

function renderRoleExperience() {
  const role = roleExperiences[state.selectedRole] || roleExperiences.employer;
  qs("#dynamicExperience").innerHTML = `
    <section class="experience-panel ${escapeHtml(state.selectedRole)}-experience">
      <div>
        <p class="eyebrow">${role.eyebrow}</p>
        <h2>${role.title}</h2>
        <p>${role.intro}</p>
        <div class="experience-actions">
          ${role.actions.map((action) => `<span>${escapeHtml(action)}</span>`).join("")}
        </div>
      </div>
      <div class="experience-side">
        ${role.statKeys.map(([key, label]) => `
          <article>
            <strong>${formatMetric(key, state.stats[key])}</strong>
            <span>${label}</span>
          </article>
        `).join("")}
        <button type="button" data-open-role="${role.target}">${role.cta}</button>
      </div>
    </section>
  `;

  document.querySelectorAll("[data-role-choice]").forEach((card) => {
    card.classList.toggle("selected", card.dataset.roleChoice === state.selectedRole);
  });

  const cta = qs("[data-open-role]");
  if (cta) {
    cta.addEventListener("click", () => {
      window.location.hash = role.target;
      showPage();
    });
  }
}

function renderWorkers(workers = state.workers) {
  const rows = workers.map((worker) => `
    <article class="table-row worker-row">
      <div>
        <strong>${escapeHtml(worker.name)}</strong>
        <span>${escapeHtml(worker.location)} · ${escapeHtml(worker.phone)}</span>
      </div>
      <div class="chips">${(worker.skills || []).slice(0, 4).map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div>
      <div>
        <strong>${escapeHtml(worker.salaryExpectation || "Negotiable")}</strong>
        <span>${escapeHtml(worker.availability || "Pending")}</span>
      </div>
      <div>
        <span class="badge ${worker.verified ? "good" : "warn"}">${worker.verified ? "Verified" : "Pending"}</span>
        <span class="subtle">${worker.rating ? `${worker.rating} rating` : "New profile"}</span>
      </div>
    </article>
  `).join("");

  qs("#workerTable").innerHTML = rows || `<div class="empty-state">No workers match this search.</div>`;
}

function jobCardHtml(job, signedInWorker) {
  return `
    <article class="record">
      <div>
        <strong>${escapeHtml(job.title)}</strong>
        <span>${escapeHtml(job.employer)} · ${escapeHtml(job.location)} · ${escapeHtml(job.category || "General")}</span>
      </div>
      <div class="chips">${(job.skills || []).map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div>
      <footer>
        <span>${escapeHtml(job.salary)}</span>
        <span class="badge">${escapeHtml(job.status)}</span>
        ${signedInWorker && job.status === "Open" ? `<button class="small-button" data-apply-job="${escapeHtml(job.id)}" type="button">Apply</button>` : ""}
      </footer>
    </article>
  `;
}

function bindApplicationButtons() {
  document.querySelectorAll("[data-apply-job]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await request("/api/applications", {
          method: "POST",
          headers: { "X-Auth-Token": state.publicToken },
          body: JSON.stringify({ jobId: button.dataset.applyJob }),
        });
        toast("Application submitted.");
        await loadAll();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

function renderJobs() {
  const signedInWorker = state.publicUser?.role === "Worker";
  const openJobs = state.jobs.filter((job) => job.status === "Open");
  qs("#jobList").innerHTML = state.jobs.map((job) => jobCardHtml(job, signedInWorker)).join("");
  qs("#availableJobList").innerHTML = openJobs.map((job) => jobCardHtml(job, signedInWorker)).join("") || `<div class="empty-state">No open jobs right now.</div>`;
  qs("#workerJobsCount").textContent = `${openJobs.length} open`;
  bindApplicationButtons();
}

function renderPlacements() {
  qs("#placementList").innerHTML = state.placements.map((placement) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(placement.worker)} → ${escapeHtml(placement.employer)}</strong>
        <span>Broker: ${escapeHtml(placement.broker)}</span>
      </div>
      <footer>
        <span>${escapeHtml(placement.commission)}</span>
        <span class="badge warn">${escapeHtml(placement.status)}</span>
      </footer>
    </article>
  `).join("");
}

function renderVerificationQueue() {
  const pending = state.workers.filter((worker) => !worker.verified);
  qs("#verificationQueue").innerHTML = pending.map((worker) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(worker.name)}</strong>
        <span>${escapeHtml(worker.location)} · ${escapeHtml(worker.riskLevel || "Normal")} risk</span>
      </div>
      <footer>
        <span>${escapeHtml(worker.verificationStatus || "Pending")}</span>
        <button class="small-button" data-verify="${escapeHtml(worker.id)}" type="button">Verify</button>
      </footer>
    </article>
  `).join("") || `<div class="empty-state">No pending worker verifications.</div>`;

  document.querySelectorAll("[data-verify]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await request(`/api/workers/${button.dataset.verify}/verify`, {
          method: "PATCH",
          headers: { "X-Admin-Token": state.adminToken },
          body: JSON.stringify({ verified: true }),
        });
        toast("Worker verified.");
        await loadAll();
      } catch (error) {
        if (error.message.includes("Admin login")) {
          clearAdminSession();
        }
        toast(error.message, "error");
      }
    });
  });
}

function renderTickets() {
  qs("#ticketList").innerHTML = state.supportTickets.map((ticket) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(ticket.topic)}</strong>
        <span>${escapeHtml(ticket.requester)}</span>
      </div>
      <footer>
        <span>${escapeHtml(ticket.priority || "Medium")}</span>
        <span class="badge ${ticket.status === "Open" ? "warn" : ""}">${escapeHtml(ticket.status)}</span>
      </footer>
    </article>
  `).join("");
}

function renderAudit() {
  qs("#auditLog").innerHTML = state.auditLog.map((item) => `
    <article>
      <span></span>
      <div>
        <strong>${escapeHtml(item.action)}</strong>
        <p>${escapeHtml(item.subject)} · ${escapeHtml(item.actor)} · ${timeAgo(item.at)}</p>
      </div>
    </article>
  `).join("") || `<div class="empty-state">No audit events yet.</div>`;
}

function profileDetailsFor(user) {
  const worker = state.workers.find((item) => item.id === user.id || item.phone === user.phone);
  const roleActions = {
    Employer: ["Post a job", "Review verified workers", "Track hiring requests"],
    Worker: ["Review available jobs", "Complete profile", "Track verification"],
    Broker: ["Assign placements", "Track commissions", "Register workers"],
    Support: ["Open support ticket", "Review requests", "Escalate issues"],
  };
  const fan = user.nationalIdStatus || worker?.nationalIdStatus || "Not provided";
  const verification = worker?.verificationStatus || user.nationalIdStatus || "Account active";
  return { worker, actions: roleActions[user.role] || ["Manage account"], fan, verification };
}

function renderAccountDashboard() {
  const panel = qs("#accountDashboard");
  const signedIn = Boolean(state.publicUser);
  qs("#publicSignIn").classList.toggle("hidden", signedIn);
  qs("#publicRegister").classList.toggle("hidden", signedIn);
  qs("#publicLogout").classList.toggle("hidden", !signedIn);
  panel.classList.toggle("hidden", !signedIn);
  if (!signedIn) {
    panel.innerHTML = "";
    return;
  }

  const user = state.publicUser;
  const profile = profileDetailsFor(user);
  const myApplications = state.applications.filter((item) => item.workerId === user.id || item.employerId === user.id);
  const myNotifications = state.notifications.filter((item) => item.userId === user.id).slice(0, 5);
  panel.innerHTML = `
    <div class="panel account-card">
      <div>
        <p class="eyebrow">My profile</p>
        <h2>${escapeHtml(user.name)}</h2>
        <p>${escapeHtml(user.role)} · ${escapeHtml(user.phone || "No phone")} · ${escapeHtml(user.address || user.city || "No address")}</p>
      </div>
      <div class="account-status-grid">
        <article><strong>${escapeHtml(profile.verification)}</strong><span>Verification status</span></article>
        <article><strong>${escapeHtml(profile.fan)}</strong><span>National ID (FAN)</span></article>
        <article><strong>${escapeHtml(user.status || "Active")}</strong><span>Account status</span></article>
      </div>
    </div>
    <div class="section-grid">
      <form id="profileUpdateForm" class="panel form-panel">
        <p class="eyebrow">Profile completion</p>
        <h2>Update profile</h2>
        <label>Name<input name="name" value="${escapeHtml(user.name || "")}" /></label>
        <label>Address<input name="address" value="${escapeHtml(user.address || "")}" /></label>
        <label>Skills<input name="skills" value="${escapeHtml((profile.worker?.skills || []).join(", "))}" placeholder="Cleaning, cooking, driving" /></label>
        <label>Availability<input name="availability" value="${escapeHtml(profile.worker?.availability || "")}" /></label>
        <label>National ID (FAN)<input name="nationalId" value="${escapeHtml(user.nationalId || profile.worker?.nationalId || "")}" /></label>
        <button type="submit">Save profile</button>
      </form>
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Notifications</p>
            <h2>Account alerts</h2>
          </div>
        </div>
        <div class="stack-list">
          ${myNotifications.map((note) => `
            <article class="record">
              <strong>${escapeHtml(note.title)}</strong>
              <span>${escapeHtml(note.body)}</span>
              <footer><span>${note.read ? "Read" : "Unread"}</span><button class="small-button" data-read-note="${escapeHtml(note.id)}" type="button">Mark read</button></footer>
            </article>
          `).join("") || `<div class="empty-state">No notifications yet.</div>`}
        </div>
      </div>
    </div>
    <div class="section-grid">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Recommended actions</p>
            <h2>${escapeHtml(user.role)} tools</h2>
          </div>
        </div>
        <div class="action-grid">
          ${profile.actions.map((action) => `<button type="button" data-account-action="${escapeHtml(action)}">${escapeHtml(action)}</button>`).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Account options</p>
            <h2>Security and support</h2>
          </div>
        </div>
        <div class="stack-list">
          <article class="record"><strong>Applications</strong><span>${myApplications.length} submitted or received</span></article>
          ${myApplications.slice(0, 4).map((app) => `<article class="record"><strong>${escapeHtml(app.jobTitle)}</strong><span>${escapeHtml(app.status)} · ${escapeHtml(app.employer || "")}</span></article>`).join("")}
          <article class="record"><strong>Support</strong><span>Use the support form for verification, placement, or payment issues.</span></article>
        </div>
      </div>
    </div>
  `;

  const profileForm = qs("#profileUpdateForm");
  if (profileForm) {
    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(profileForm);
      try {
        const updated = await request(`/api/users/${user.id}/profile`, {
          method: "PATCH",
          headers: { "X-Auth-Token": state.publicToken },
          body: JSON.stringify({
            name: form.get("name"),
            address: form.get("address"),
            skills: form.get("skills"),
            availability: form.get("availability"),
            nationalId: form.get("nationalId"),
          }),
        });
        state.publicUser = updated;
        writeStoredPublicSession(state.publicToken, updated);
        toast("Profile updated.");
        await loadAll();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  document.querySelectorAll("[data-read-note]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await request(`/api/notifications/${button.dataset.readNote}/read`, {
          method: "PATCH",
          headers: { "X-Auth-Token": state.publicToken },
          body: JSON.stringify({}),
        });
        await loadAll();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });

  document.querySelectorAll("[data-account-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const label = button.dataset.accountAction;
      if (label.includes("Post")) window.location.hash = "employer";
      else if (label.includes("worker") || label.includes("profile") || label.includes("jobs")) window.location.hash = "employee";
      else if (label.includes("placement") || label.includes("commission")) window.location.hash = "broker";
      else window.location.hash = "support";
      showPage();
    });
  });
}

function renderAll() {
  renderMetrics();
  renderRoleExperience();
  renderAccountDashboard();
  renderWorkers();
  renderJobs();
  renderPlacements();
  renderVerificationQueue();
  renderTickets();
  renderAudit();
}

function currentPage() {
  const raw = window.location.hash.replace("#", "") || "overview";
  return pageTitles[raw] ? raw : "overview";
}

function isStaffPortal() {
  return new URLSearchParams(window.location.search).get("staff") === "1";
}

function showPage() {
  let page = currentPage();
  if (page === "admin" && !isStaffPortal()) {
    page = "overview";
    history.replaceState(null, "", "#overview");
  }
  document.querySelectorAll("[data-page]").forEach((section) => {
    section.classList.toggle("active-page", section.dataset.page === page);
  });
  document.querySelectorAll("[data-page-link]").forEach((link) => {
    link.classList.toggle("active", link.dataset.pageLink === page);
  });
  qs("#pageTitle").textContent = pageTitles[page];
  updateAdminGate();
  if (window.location.hash !== `#${page}`) {
    history.replaceState(null, "", `#${page}`);
  }
}

function updateAdminGate() {
  const privateArea = qs("#adminPrivateArea");
  const loginForm = qs("#adminLoginForm");
  if (!privateArea || !loginForm) return;
  privateArea.classList.toggle("locked-area", !state.adminToken);
  loginForm.classList.toggle("hidden", Boolean(state.adminToken));
  document.querySelectorAll(".master-only").forEach((element) => {
    element.classList.toggle("locked-area", state.currentUser?.role !== "MasterAdmin");
  });
}

async function loadAll() {
  try {
    const data = await request("/api/bootstrap");
    const preservedToken = state.adminToken;
    const preservedUser = state.currentUser;
    const preservedPublicToken = state.publicToken;
    const preservedPublicUser = state.publicUser;
    Object.assign(state, data);
    state.adminToken = preservedToken;
    state.currentUser = preservedUser;
    state.publicToken = preservedPublicToken;
    state.publicUser = preservedPublicUser;
    await validateAdminSession();
    await loadAccountData();
    renderAll();
    updateAdminGate();
  } catch (error) {
    toast(error.message, "error");
  }
}

function wireForms() {
  qs("#publicRegister").addEventListener("click", () => {
    window.location.hash = "employee";
    showPage();
  });
  qs("#publicSignIn").addEventListener("click", () => {
    window.location.hash = "overview";
    showPage();
    qs("#publicLoginForm").classList.remove("hidden");
    qs("#publicLoginForm input[name='username']").focus();
  });
  qs("#publicLogout").addEventListener("click", () => {
    state.publicToken = "";
    state.publicUser = null;
    removeStoredPublicSession();
    renderAccountDashboard();
    toast("Signed out.");
  });
  window.addEventListener("hashchange", showPage);

  document.querySelectorAll("[data-role-choice]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedRole = card.dataset.roleChoice;
      renderRoleExperience();
    });
  });

  qs("#searchWorkers").addEventListener("click", async () => {
    const params = new URLSearchParams({
      skill: qs("#skillFilter").value.trim(),
      location: qs("#locationFilter").value.trim(),
      verified: qs("#verifiedFilter").value,
    });
    const workers = await request(`/api/workers?${params.toString()}`);
    renderWorkers(workers);
  });

  qs("#registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request("/api/users/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          phone: form.get("phone"),
          username: form.get("username"),
          password: form.get("password"),
          role: form.get("role"),
          nationalId: form.get("nationalId"),
          address: form.get("address"),
          skills: splitList(form.get("skills") || ""),
          availability: form.get("availability"),
        }),
      });
      formElement.reset();
      toast("Profile created and queued for verification.");
      await loadAll();
    } catch (error) {
      if (error.message.includes("Admin login")) {
        clearAdminSession();
      }
      toast(error.message, "error");
    }
  });
  qs("#registerForm select[name='role']").addEventListener("change", updateNationalIdRequirement);
  updateNationalIdRequirement();

  qs("#jobForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await request("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        title: form.get("title"),
        employer: form.get("employer"),
        location: form.get("location"),
        category: form.get("category"),
        skills: splitList(form.get("skills") || ""),
        salary: form.get("salary"),
      }),
    });
    formElement.reset();
    toast("Job published.");
    await loadAll();
  });

  qs("#placementForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await request("/api/placements", {
      method: "POST",
      body: JSON.stringify({
        worker: form.get("worker"),
        employer: form.get("employer"),
        broker: form.get("broker"),
        commission: form.get("commission"),
      }),
    });
    formElement.reset();
    toast("Placement created.");
    await loadAll();
  });

  qs("#staffRegisterForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request("/api/staff/register", {
        method: "POST",
        headers: { "X-Admin-Token": state.adminToken },
        body: JSON.stringify({
          name: form.get("name"),
          phone: form.get("phone"),
          role: form.get("role"),
          username: form.get("username"),
          password: form.get("password"),
          address: form.get("address"),
        }),
      });
      formElement.reset();
      toast("Staff account created.");
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  qs("#adminLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const session = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      state.adminToken = session.token;
      state.currentUser = session.user;
      writeStoredAdminToken(session.token);
      formElement.reset();
      updateAdminGate();
      toast(`${session.user.role} signed in.`);
    } catch (error) {
      toast(error.message, "error");
    }
  });

  qs("#publicLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const session = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      if (["MasterAdmin", "Manager"].includes(session.user.role)) {
        toast("Staff accounts must use the private staff portal.", "error");
        return;
      }
      state.publicToken = session.token;
      state.publicUser = session.user;
      writeStoredPublicSession(session.token, session.user);
      formElement.reset();
      qs("#publicLoginForm").classList.add("hidden");
      await loadAccountData();
      renderAccountDashboard();
      toast(`${session.user.role} signed in.`);
    } catch (error) {
      toast(error.message, "error");
    }
  });

  qs("#ticketForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await request("/api/support/tickets", {
      method: "POST",
      body: JSON.stringify({
        requester: form.get("requester"),
        topic: form.get("topic"),
        priority: form.get("priority"),
      }),
    });
    formElement.reset();
    toast("Support ticket opened.");
    await loadAll();
  });

  qs("#categoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request("/api/job-categories", {
        method: "POST",
        headers: { "X-Admin-Token": state.adminToken },
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
        }),
      });
      formElement.reset();
      toast("Job category added.");
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

wireForms();
showPage();
loadAll();
