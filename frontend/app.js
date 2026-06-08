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
  staffApplications: [],
  notifications: [],
  complianceRequests: [],
  safetyReports: [],
  payments: [],
  talents: [],
  talentOpportunities: [],
  talentMatches: [],
  successStories: [],
  stats: {},
  selectedRole: "employer",
  adminToken: readStoredAdminToken(),
  currentUser: null,
  publicToken: readStoredPublicToken(),
  publicUser: readStoredPublicUser(),
  registerStep: 1,
  adminTab: "overview",
};

const staffRoles = [
  "MasterAdmin",
  "CountryAdmin",
  "RegionalManager",
  "VerificationOfficer",
  "SupportAgent",
  "FinanceOfficer",
  "ComplianceOfficer",
  "Manager",
];

const staffCapabilities = {
  MasterAdmin: ["staff", "category", "verification", "applications", "support", "finance", "compliance", "audit", "settings"],
  CountryAdmin: ["staff", "category", "verification", "applications", "support", "finance", "compliance", "audit"],
  RegionalManager: ["verification", "applications", "support", "audit"],
  VerificationOfficer: ["verification", "applications"],
  SupportAgent: ["support", "applications"],
  FinanceOfficer: ["finance", "applications"],
  ComplianceOfficer: ["compliance", "audit"],
  Manager: ["verification", "applications", "support", "category", "audit"],
};

const registerStepCount = 4;

const metricLabels = [
  ["workers", "Workers"],
  ["verifiedWorkers", "Verified"],
  ["openJobs", "Open jobs"],
  ["activePlacements", "Active placements"],
  ["openTickets", "Open tickets"],
  ["verificationRate", "Verification"],
  ["averageRating", "Avg rating"],
  ["fraudAlerts", "Risk alerts"],
  ["payments", "Payments"],
];

const heroMetrics = [
  ["users", "registered identities"],
  ["brokers", "broker partners"],
  ["employers", "employer accounts"],
];

const pageTitles = {
  overview: "Choose your role",
  talent: "Talent network",
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
    actions: ["Posted Jobs", "Applicants", "Shortlisted Workers", "Active Placements", "Payments", "Reviews", "Support Tickets"],
    statKeys: [["openJobs", "open jobs"], ["verifiedWorkers", "verified workers"], ["averageRating", "average rating"]],
    target: "employer",
    cta: "Open Employer Workspace",
  },
  employee: {
    eyebrow: "Worker experience",
    title: "Find work and build a trusted profile.",
    intro: "Workers can track readiness, visibility, reputation, and verification from one place.",
    actions: ["Profile Completion", "Available Jobs", "Applications", "Verification Status", "Ratings", "Work History", "Earnings", "Safety Reports"],
    statKeys: [["openJobs", "available jobs"], ["verificationRate", "verification rate"], ["averageRating", "average rating"]],
    target: "employee",
    cta: "Open Worker Workspace",
  },
  broker: {
    eyebrow: "Broker experience",
    title: "Manage placements, workers, and commissions.",
    intro: "Agencies and local brokers can coordinate assignments while keeping trust signals visible.",
    actions: ["Managed Workers", "Employer Requests", "Placements", "Commission", "Verification Status", "Performance Report"],
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

function publicAuthHeaders() {
  return state.publicToken ? { "X-Auth-Token": state.publicToken } : {};
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
  let response;
  try {
    response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
  } catch {
    throw new Error("Could not reach the backend. Start the server and refresh the page.");
  }
  const payload = await response.json();
  if (!response.ok) {
    const message = payload.error || "Request failed";
    throw new Error(message);
  }
  return payload;
}

function clearAdminSession() {
  state.adminToken = "";
  state.currentUser = null;
  state.staffApplications = [];
  removeStoredAdminToken();
  updateAdminGate();
}

async function validateAdminSession() {
  if (!state.adminToken) return;
  let response;
  try {
    response = await fetch("/api/auth/session", {
      headers: { "X-Admin-Token": state.adminToken },
    });
  } catch {
    clearAdminSession();
    return;
  }
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

async function loadStaffData() {
  if (!state.adminToken || !state.currentUser) {
    state.staffApplications = [];
    return;
  }
  try {
    state.staffApplications = await request("/api/applications", {
      headers: { "X-Admin-Token": state.adminToken },
    });
  } catch {
    state.staffApplications = [];
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

  const quickStats = qs("#staffQuickStats");
  if (quickStats) {
    quickStats.innerHTML = [
      ["workers", "Workers"],
      ["openJobs", "Open jobs"],
      ["applications", "Applications"],
      ["users", "Users"],
    ].map(([key, label]) => `
      <article data-admin-record-jump="${key === "applications" ? "applications" : "records"}">
        <strong>${formatMetric(key, state.stats[key])}</strong>
        <span>${label}</span>
      </article>
    `).join("");
  }

  const adminMetrics = qs("#adminMetrics");
  if (adminMetrics) {
    adminMetrics.innerHTML = [
      ["workers", "Workers"],
      ["openJobs", "Open jobs"],
      ["applications", "Applications"],
      ["users", "Users"],
    ].map(([key, label]) => `
      <article class="metric-card">
        <span>${label}</span>
        <strong>${formatMetric(key, state.stats[key])}</strong>
      </article>
    `).join("");
  }

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

function updateIdentityDocumentRequirement() {
  const roleSelect = qs("#registerForm select[name='role']");
  const identityNumber = qs("#identityDocumentNumberInput");
  const hint = qs("#identityDocumentHint");
  const title = qs("#registerTitle");
  const eyebrow = qs("#registerEyebrow");
  const submit = qs("#registerSubmit");
  const nameLabel = qs("#registerNameLabelText");
  const nameInput = qs("#registerNameInput");
  const intro = qs("#registerIntro");
  if (!roleSelect || !identityNumber || !hint) return;
  const employer = roleSelect.value === "Employer";
  const roleLabel = roleSelect.value === "Broker" ? "broker / agency" : roleSelect.value.toLowerCase();
  identityNumber.required = employer;
  identityNumber.placeholder = employer
    ? "Required identity document number"
    : "Optional identity document number";
  hint.textContent = employer
    ? "Identity document number is required for employer accounts."
    : "Identity document number is optional for workers and broker accounts.";
  if (title) title.textContent = `Create ${roleLabel} account`;
  if (eyebrow) eyebrow.textContent = `${roleSelect.value} registration`;
  if (submit) submit.textContent = `Create ${roleLabel} account`;
  if (nameLabel) {
    nameLabel.textContent = roleSelect.value === "Employer"
      ? "Organization / employer name"
      : roleSelect.value === "Broker"
        ? "Agency or broker name"
        : "Full legal name";
  }
  if (nameInput) {
    nameInput.placeholder = roleSelect.value === "Employer"
      ? "Company, family, or organization name"
      : roleSelect.value === "Broker"
        ? "Licensed agency or broker name"
        : "Worker full legal name";
  }
  if (intro) {
    intro.textContent = roleSelect.value === "Employer"
      ? "Create an employer account to post jobs, review applicants, and manage placements."
      : roleSelect.value === "Broker"
        ? "Create a broker or agency account to manage workers, placements, and commission records."
        : "Create a worker account to apply for jobs, complete verification, and manage your profile.";
  }
  updateRoleSpecificFields(roleSelect.value);
}

function updateRoleSpecificFields(role) {
  document.querySelectorAll("[data-role-field]").forEach((field) => {
    field.classList.toggle("hidden", field.dataset.roleField !== role);
  });
  const stepFour = qs('[data-step-pill="4"]');
  if (!stepFour) return;
  if (role === "Employer") stepFour.textContent = "Hiring details";
  else if (role === "Broker") stepFour.textContent = "Agency details";
  else stepFour.textContent = "Worker profile";
}

function updateRegisterStep() {
  const step = Math.min(Math.max(state.registerStep, 1), registerStepCount);
  state.registerStep = step;
  document.querySelectorAll("[data-register-step]").forEach((element) => {
    element.classList.toggle("hidden-step", Number(element.dataset.registerStep) !== step);
  });
  document.querySelectorAll("[data-step-pill]").forEach((pill) => {
    const pillStep = Number(pill.dataset.stepPill);
    pill.classList.toggle("active", pillStep === step);
    pill.classList.toggle("complete", pillStep < step);
  });
  qs("#registerPrev").classList.toggle("hidden", step === 1);
  qs("#registerNext").classList.toggle("hidden", step === registerStepCount);
  qs("#registerSubmit").classList.toggle("hidden", step !== registerStepCount);
}

function validateRegisterStep() {
  const currentStep = qs(`[data-register-step="${state.registerStep}"]`);
  if (!currentStep) return true;
  const fields = currentStep.querySelectorAll("input, select, textarea");
  for (const field of fields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  return true;
}

function resetRegisterStep() {
  state.registerStep = 1;
  updateRegisterStep();
}

function openRegistration(role = "Worker") {
  window.location.hash = "employee";
  showPage();
  const roleSelect = qs("#registerForm select[name='role']");
  if (roleSelect) {
    roleSelect.value = role;
    updateIdentityDocumentRequirement();
  }
  resetRegisterStep();
  qs("#registerForm")?.scrollIntoView({ block: "start", behavior: "smooth" });
}

function openPublicSignIn(username = "") {
  window.location.hash = "overview";
  showPage();
  const form = qs("#publicLoginForm");
  form.classList.remove("hidden");
  qs("#forgotPasswordForm")?.classList.add("hidden");
  const usernameInput = qs("#publicLoginForm input[name='username']");
  if (username) usernameInput.value = username;
  qs("#publicLoginForm input[name='password']").focus();
}

function openForgotPassword() {
  window.location.hash = "overview";
  showPage();
  qs("#publicLoginForm")?.classList.add("hidden");
  const form = qs("#forgotPasswordForm");
  form.classList.remove("hidden");
  qs("#forgotPasswordForm input[name='requester']").focus();
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
        <span>${escapeHtml(job.salary)} ${escapeHtml(job.currency || "")}</span>
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

function renderApplicationQueue() {
  const queue = qs("#applicationQueue");
  const count = qs("#applicationQueueCount");
  if (!queue || !count) return;
  const applications = state.staffApplications || [];
  const waiting = applications.filter((item) => item.status === "Submitted").length;
  count.textContent = `${waiting} waiting`;
  queue.innerHTML = applications.map((application) => `
    <article class="record application-record">
      <div>
        <strong>${escapeHtml(application.workerName || "Worker")} → ${escapeHtml(application.jobTitle || "Job")}</strong>
        <span>${escapeHtml(application.employer || "Employer")} · ${timeAgo(application.createdAt)}</span>
      </div>
      <footer>
        <span class="badge ${application.status === "Accepted" ? "good" : application.status === "Rejected" ? "danger" : application.status === "Shortlisted" ? "warn" : ""}">${escapeHtml(application.status)}</span>
        <div class="queue-actions">
          <button class="small-button secondary-button" data-application-status="Shortlisted" data-application-id="${escapeHtml(application.id)}" type="button">Shortlist</button>
          <button class="small-button" data-application-status="Accepted" data-application-id="${escapeHtml(application.id)}" type="button">Accept</button>
          <button class="small-button danger-button" data-application-status="Rejected" data-application-id="${escapeHtml(application.id)}" type="button">Reject</button>
        </div>
      </footer>
    </article>
  `).join("") || `<div class="empty-state">No applications submitted yet.</div>`;

  document.querySelectorAll("[data-application-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await request(`/api/applications/${button.dataset.applicationId}/status`, {
          method: "PATCH",
          headers: { "X-Admin-Token": state.adminToken },
          body: JSON.stringify({ status: button.dataset.applicationStatus }),
        });
        toast(`Application ${button.dataset.applicationStatus.toLowerCase()}.`);
        await loadAll();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

function talentStatusClass(status) {
  if (["Approved", "Published"].includes(status)) return "good";
  if (["Correction Required", "Pending Review"].includes(status)) return "warn";
  if (["Rejected", "Closed"].includes(status)) return "danger";
  return "";
}

function renderTalentNetwork() {
  const talentList = qs("#talentProfileList");
  const opportunityList = qs("#talentOpportunityList");
  const matchList = qs("#talentMatchList");
  const storyList = qs("#successStoryList");
  if (!talentList || !opportunityList || !matchList || !storyList) return;

  const talents = state.talents || [];
  const opportunities = state.talentOpportunities || [];
  const matches = state.talentMatches || [];
  const stories = state.successStories || [];
  const canReview = Boolean(state.adminToken && staffCapabilities[state.currentUser?.role]?.includes("talent"));

  talentList.innerHTML = talents.map((talent) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(talent.name)}</strong>
        <span>${escapeHtml(talent.category)} · ${escapeHtml(talent.country || "International")} · ${escapeHtml(talent.education || "Education pending")}</span>
      </div>
      <div class="chips">${(talent.skills || []).slice(0, 5).map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div>
      <footer>
        <span class="badge ${talentStatusClass(talent.status)}">${escapeHtml(talent.verificationLevel || talent.status)}</span>
        ${canReview ? `<div class="queue-actions">
          <button class="small-button" data-talent-approve="${escapeHtml(talent.id)}" type="button">Approve</button>
          <button class="small-button secondary-button" data-talent-correction="${escapeHtml(talent.id)}" type="button">Correction</button>
        </div>` : `<span>${escapeHtml(talent.readiness || "Submitted")}</span>`}
      </footer>
    </article>
  `).join("") || `<div class="empty-state">No talent profiles submitted yet.</div>`;

  opportunityList.innerHTML = opportunities.map((opportunity) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(opportunity.title)}</strong>
        <span>${escapeHtml(opportunity.provider)} · ${escapeHtml(opportunity.opportunityType)} · ${escapeHtml(opportunity.country || "International")}</span>
      </div>
      <div class="chips">${(opportunity.skills || []).slice(0, 5).map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div>
      <footer>
        <span class="badge ${talentStatusClass(opportunity.status)}">${escapeHtml(opportunity.status)}</span>
        ${canReview ? `<div class="queue-actions">
          <button class="small-button" data-opportunity-publish="${escapeHtml(opportunity.id)}" type="button">Publish</button>
          <button class="small-button secondary-button" data-opportunity-correction="${escapeHtml(opportunity.id)}" type="button">Correction</button>
        </div>` : `<span>${escapeHtml(opportunity.deadline || "Rolling deadline")}</span>`}
      </footer>
    </article>
  `).join("") || `<div class="empty-state">No opportunities posted yet.</div>`;

  matchList.innerHTML = matches.map((match) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(match.talentName)} → ${escapeHtml(match.opportunityTitle)}</strong>
        <span>${escapeHtml(match.provider)} · ${escapeHtml((match.reasons || []).join(", ") || "profile match")}</span>
      </div>
      <footer>
        <span class="badge good">${escapeHtml(match.score)}% match</span>
      </footer>
    </article>
  `).join("") || `<div class="empty-state">Approve talent profiles and publish opportunities to generate matches.</div>`;

  storyList.innerHTML = stories.map((story) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(story.talentName)} · ${escapeHtml(story.outcome)}</strong>
        <span>${escapeHtml(story.opportunity || "Opportunity confirmed")}</span>
      </div>
      <p>${escapeHtml(story.story || "Success record published.")}</p>
    </article>
  `).join("") || `<div class="empty-state">No success stories published yet.</div>`;

  document.querySelectorAll("[data-talent-approve]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await request(`/api/talents/${button.dataset.talentApprove}/status`, {
          method: "PATCH",
          headers: { "X-Admin-Token": state.adminToken },
          body: JSON.stringify({ status: "Approved", verificationLevel: "Skill Verified" }),
        });
        toast("Talent approved.");
        await loadAll();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });

  document.querySelectorAll("[data-talent-correction]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await request(`/api/talents/${button.dataset.talentCorrection}/status`, {
          method: "PATCH",
          headers: { "X-Admin-Token": state.adminToken },
          body: JSON.stringify({ status: "Correction Required", verificationLevel: "Submitted" }),
        });
        toast("Talent correction requested.");
        await loadAll();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });

  document.querySelectorAll("[data-opportunity-publish]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await request(`/api/talent-opportunities/${button.dataset.opportunityPublish}/status`, {
          method: "PATCH",
          headers: { "X-Admin-Token": state.adminToken },
          body: JSON.stringify({ status: "Published" }),
        });
        toast("Opportunity published.");
        await loadAll();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });

  document.querySelectorAll("[data-opportunity-correction]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await request(`/api/talent-opportunities/${button.dataset.opportunityCorrection}/status`, {
          method: "PATCH",
          headers: { "X-Admin-Token": state.adminToken },
          body: JSON.stringify({ status: "Correction Required" }),
        });
        toast("Opportunity correction requested.");
        await loadAll();
      } catch (error) {
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

function dashboardCard(title, value, detail, action = "") {
  return `
    <article class="dashboard-card">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(detail)}</p>
      ${action}
    </article>
  `;
}

function adminRecordButton(label) {
  return `<button class="small-button" type="button" data-admin-record-jump="records">${escapeHtml(label)}</button>`;
}

function renderAdminRecords() {
  const openJobs = state.jobs.filter((job) => job.status === "Open");
  const reports = [
    ...(state.safetyReports || []).map((item) => ({ title: item.reportType, owner: item.reporter, status: item.status, type: "Safety" })),
    ...(state.complianceRequests || []).map((item) => ({ title: item.requestType, owner: item.requester, status: item.status, type: "Compliance" })),
    ...(state.supportTickets || []).map((item) => ({ title: item.topic, owner: item.requester, status: item.status, type: "Support" })),
  ];

  qs("#adminWorkersCount").textContent = `${state.workers.length} workers`;
  qs("#adminJobsCount").textContent = `${openJobs.length} open`;
  qs("#adminUsersCount").textContent = `${state.users.length} users`;
  qs("#adminPaymentsCount").textContent = `${state.payments.length} payments`;
  qs("#adminReportsCount").textContent = `${reports.length} reports`;

  qs("#adminWorkersList").innerHTML = state.workers.map((worker) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(worker.name)}</strong>
        <span>${escapeHtml(worker.location || worker.city || "No location")} · ${escapeHtml(worker.phone || "No phone")}</span>
      </div>
      <div class="chips">${(worker.skills || []).slice(0, 3).map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div>
      <footer>
        <span>${escapeHtml(worker.availability || "Pending")}</span>
        <span class="badge ${worker.verified ? "good" : "warn"}">${worker.verified ? "Verified" : "Pending"}</span>
      </footer>
    </article>
  `).join("") || `<div class="empty-state">No workers yet.</div>`;

  qs("#adminJobsList").innerHTML = openJobs.map((job) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(job.title)}</strong>
        <span>${escapeHtml(job.employer)} · ${escapeHtml(job.location)} · ${escapeHtml(job.category || "General")}</span>
      </div>
      <footer>
        <span>${escapeHtml(job.salary || "Negotiable")} ${escapeHtml(job.currency || "")}</span>
        <span class="badge good">${escapeHtml(job.status)}</span>
      </footer>
    </article>
  `).join("") || `<div class="empty-state">No open jobs.</div>`;

  qs("#adminUsersList").innerHTML = state.users.map((user) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <span>${escapeHtml(user.phone || "No phone")} · ${escapeHtml(user.city || "No city")}, ${escapeHtml(user.country || "No country")}</span>
      </div>
      <footer>
        <span>${escapeHtml(user.status || "Active")}</span>
        <span class="badge">${escapeHtml(user.role)}</span>
      </footer>
    </article>
  `).join("") || `<div class="empty-state">No users yet.</div>`;

  qs("#adminPaymentsList").innerHTML = state.payments.map((payment) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(payment.invoiceNumber || payment.id)}</strong>
        <span>${escapeHtml(payment.payer)} · ${escapeHtml(payment.method)}</span>
      </div>
      <footer>
        <span>${escapeHtml(payment.amount)} ${escapeHtml(payment.currency || "")}</span>
        <span class="badge warn">${escapeHtml(payment.status || "Pending")}</span>
      </footer>
    </article>
  `).join("") || `<div class="empty-state">No payment records yet.</div>`;

  qs("#adminReportsList").innerHTML = reports.map((report) => `
    <article class="record">
      <div>
        <strong>${escapeHtml(report.title)}</strong>
        <span>${escapeHtml(report.type)} · ${escapeHtml(report.owner || "Unknown requester")}</span>
      </div>
      <footer>
        <span>${escapeHtml(report.type)}</span>
        <span class="badge ${report.status === "Open" || report.status === "Reviewing" ? "warn" : ""}">${escapeHtml(report.status || "Open")}</span>
      </footer>
    </article>
  `).join("") || `<div class="empty-state">No reports or requests yet.</div>`;
}

function renderRoleDashboards() {
  const openJobs = state.jobs.filter((job) => job.status === "Open");
  const applicationPool = state.staffApplications.length ? state.staffApplications : state.applications;
  const submittedApplications = applicationPool.filter((item) => item.status === "Submitted");
  const activePlacements = state.placements.filter((item) => !["Closed", "Cancelled"].includes(item.status));
  const pendingPayments = state.payments.filter((item) => item.status !== "Paid");
  const openTickets = state.supportTickets.filter((item) => item.status !== "Closed");
  const pendingWorkers = state.workers.filter((worker) => !worker.verified);
  const safetyReports = state.safetyReports || [];
  const complianceRequests = state.complianceRequests || [];

  qs("#employerDashboard").innerHTML = [
    dashboardCard("Posted jobs", state.jobs.length, "All demand records published in the marketplace.", `<button class="small-button" type="button" data-scroll-target="jobForm">Post job</button>`),
    dashboardCard("Applicants", submittedApplications.length, "Applications waiting for review and shortlist decisions."),
    dashboardCard("Active placements", activePlacements.length, "Workers currently in scheduled or trial placements."),
    dashboardCard("Payments", pendingPayments.length, "Invoices, wallet, commission, and payment records."),
    dashboardCard("Support tickets", openTickets.length, "Open employer, worker, and broker support issues.", `<button class="small-button" type="button" data-open-page="support">Open support</button>`),
  ].join("");

  qs("#workerDashboard").innerHTML = [
    dashboardCard("Profile completion", `${profileCompletionScore()}%`, "Profile strength based on identity, contact, skills, and location."),
    dashboardCard("Available jobs", openJobs.length, "Open jobs ready for worker applications."),
    dashboardCard("Applications", state.applications.length, "Submitted applications and placement progress."),
    dashboardCard("Verification", `${state.stats.verificationRate || 0}%`, "Platform worker verification coverage."),
    dashboardCard("Safety reports", safetyReports.length, "Emergency, employer report, dispute, and workplace safety cases.", `<button class="small-button" type="button" data-open-page="support">Report safety</button>`),
  ].join("");

  qs("#brokerDashboard").innerHTML = [
    dashboardCard("Managed workers", state.workers.length, "Worker profiles available for placement and verification."),
    dashboardCard("Employer requests", openJobs.length, "Open employer demand that brokers can help fulfill."),
    dashboardCard("Placements", state.placements.length, "Placement records and assignment pipeline."),
    dashboardCard("Commission", pendingPayments.length, "Pending invoices, wallet records, and commission tracking.", `<button class="small-button" type="button" data-scroll-target="paymentForm">Create invoice</button>`),
    dashboardCard("Performance report", `${activePlacements.length} active`, "Current active placement performance signal."),
  ].join("");

  qs("#adminOpsDashboard").innerHTML = [
    dashboardCard("Workers", state.workers.length, "Total worker profiles in the marketplace.", adminRecordButton("View workers")),
    dashboardCard("Open jobs", openJobs.length, "Employer demand currently accepting applicants.", adminRecordButton("View jobs")),
    dashboardCard("Applications", state.stats.applications || applicationPool.length, "All submitted worker applications visible to staff.", `<button class="small-button" type="button" data-admin-record-jump="applications">View applications</button>`),
    dashboardCard("Users", state.users.length, "Employers, workers, brokers, and staff identities.", adminRecordButton("View users")),
    dashboardCard("Categories", state.jobCategories.length, "Job categories managed by staff.", `<button class="small-button" type="button" data-scroll-target="categoryForm">Add category</button>`),
    dashboardCard("Verifications", pendingWorkers.length, "Workers waiting for staff verification."),
    dashboardCard("Fraud alerts", state.fraudAlerts.length, "Risk signals and suspicious account activity."),
    dashboardCard("Payments", state.payments.length, "Finance records and invoice activity.", adminRecordButton("View payments")),
    dashboardCard("Reports", safetyReports.length + complianceRequests.length, "Safety and compliance reports requiring review.", adminRecordButton("View reports")),
    dashboardCard("Audit logs", state.auditLog.length, "Recent staff and system actions."),
  ].join("");

  document.querySelectorAll("[data-open-page]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.hash = button.dataset.openPage;
      showPage();
    });
  });

  document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      qs(`#${button.dataset.scrollTarget}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-admin-record-jump], [data-admin-record-shortcut]").forEach((element) => {
    element.addEventListener("click", () => {
      state.adminTab = element.dataset.adminRecordJump || "records";
      updateAdminTabs();
      qs(`[data-admin-panel="${state.adminTab}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  });
}

function uniqueCount(values) {
  return new Set(values.filter(Boolean)).size;
}

function profileCompletionScore() {
  if (!state.publicUser) return 0;
  const profile = profileDetailsFor(state.publicUser);
  const checks = [
    state.publicUser.name,
    state.publicUser.phone,
    state.publicUser.country,
    state.publicUser.city,
    state.publicUser.language,
    state.publicUser.currency,
    profile.identity !== "Not provided",
    profile.worker?.skills?.length,
    profile.worker?.availability,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function profileDetailsFor(user) {
  const worker = state.workers.find((item) => item.id === user.id || item.phone === user.phone);
  const roleActions = {
    Employer: ["Posted jobs", "Applicants", "Shortlisted workers", "Active placements", "Payments", "Reviews", "Support tickets"],
    Worker: ["Profile completion", "Available jobs", "Applications", "Verification status", "Ratings", "Work history", "Earnings", "Safety reports"],
    Broker: ["Managed workers", "Employer requests", "Placements", "Commission", "Verification status", "Performance report"],
  };
  const identity = user.identityStatus || user.nationalIdStatus || worker?.identityStatus || worker?.nationalIdStatus || "Not provided";
  const verification = worker?.verificationStatus || user.identityStatus || user.nationalIdStatus || "Account active";
  return { worker, actions: roleActions[user.role] || ["Manage account"], identity, verification };
}

function renderAccountDashboard() {
  const panel = qs("#accountDashboard");
  const signedIn = Boolean(state.publicUser);
  updatePublicAuthControls();
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
        <p>${escapeHtml(user.role)} · ${escapeHtml(user.phone || "No phone")} · ${escapeHtml(user.city || "No city")}, ${escapeHtml(user.country || "No country")}</p>
      </div>
      <div class="account-status-grid">
        <article><strong>${escapeHtml(profile.verification)}</strong><span>Verification status</span></article>
        <article><strong>${escapeHtml(profile.identity)}</strong><span>Identity status</span></article>
        <article><strong>${escapeHtml(user.status || "Active")}</strong><span>Account status</span></article>
      </div>
    </div>
    <div class="section-grid">
      <form id="profileUpdateForm" class="panel form-panel">
        <p class="eyebrow">Profile completion</p>
        <h2>Update profile</h2>
        <label>Name<input name="name" value="${escapeHtml(user.name || "")}" /></label>
        <label>Address<input name="address" value="${escapeHtml(user.address || "")}" /></label>
        <label>Country<input name="country" value="${escapeHtml(user.country || "")}" /></label>
        <label>City<input name="city" value="${escapeHtml(user.city || "")}" /></label>
        <label>Language<input name="language" value="${escapeHtml(user.language || "")}" /></label>
        <label>Currency<input name="currency" value="${escapeHtml(user.currency || "")}" /></label>
        <label>Timezone<input name="timezone" value="${escapeHtml(user.timezone || "")}" /></label>
        <label>Preferred contact method<input name="preferredContactMethod" value="${escapeHtml(user.preferredContactMethod || "")}" /></label>
        <label>Skills<input name="skills" value="${escapeHtml((profile.worker?.skills || []).join(", "))}" placeholder="Cleaning, cooking, driving" /></label>
        <label>Availability<input name="availability" value="${escapeHtml(profile.worker?.availability || "")}" /></label>
        <label>Identity document type
          <select name="identityDocumentType">
            ${["National ID", "Passport", "Refugee ID", "Residence Permit", "Driver License", "Other Government ID"].map((type) => `<option ${type === (user.identityDocumentType || profile.worker?.identityDocumentType) ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label>Identity document number<input name="identityDocumentNumber" value="${escapeHtml(user.identityDocumentNumber || profile.worker?.identityDocumentNumber || user.nationalId || "")}" /></label>
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
            country: form.get("country"),
            city: form.get("city"),
            language: form.get("language"),
            currency: form.get("currency"),
            timezone: form.get("timezone"),
            preferredContactMethod: form.get("preferredContactMethod"),
            skills: form.get("skills"),
            availability: form.get("availability"),
            identityDocumentType: form.get("identityDocumentType"),
            identityDocumentNumber: form.get("identityDocumentNumber"),
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
      if (label.includes("Post") || label.includes("Applicant") || label.includes("Payment") || label.includes("Review")) window.location.hash = "employer";
      else if (label.includes("worker") || label.includes("profile") || label.includes("jobs") || label.includes("Safety") || label.includes("Earnings")) window.location.hash = "employee";
      else if (label.includes("placement") || label.includes("commission") || label.includes("Performance")) window.location.hash = "broker";
      else window.location.hash = "support";
      showPage();
    });
  });
}

function updatePublicAuthControls() {
  const staffPage = currentPage() === "admin" && isStaffPortal();
  const signedIn = Boolean(state.publicUser);
  const badge = qs("#publicSessionBadge");
  qs("#publicSignIn").classList.toggle("hidden", staffPage || signedIn);
  qs("#publicRegister").classList.toggle("hidden", staffPage || signedIn);
  qs("#publicLogout").classList.toggle("hidden", staffPage || !signedIn);
  if (badge) {
    badge.classList.toggle("hidden", staffPage || !signedIn);
    badge.textContent = signedIn ? `${state.publicUser.name} · ${state.publicUser.role}` : "";
  }
}

function renderAll() {
  renderMetrics();
  renderRoleExperience();
  renderAccountDashboard();
  renderWorkers();
  renderJobs();
  renderPlacements();
  renderVerificationQueue();
  renderApplicationQueue();
  renderTickets();
  renderAudit();
  renderAdminRecords();
  renderRoleDashboards();
  renderTalentNetwork();
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
  qs("#pageTitle").textContent = page === "admin" && state.adminToken ? "Operations workspace" : pageTitles[page];
  updatePublicAuthControls();
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
  const identity = qs("#staffIdentity");
  const sessionInfo = qs("#staffSessionInfo");
  if (identity) identity.textContent = state.currentUser ? `${state.currentUser.name} · ${state.currentUser.role}` : "Signed in";
  if (sessionInfo) sessionInfo.textContent = state.currentUser ? `${state.currentUser.country || "Global"} staff access` : "Secure staff session";
  if (currentPage() === "admin") {
    qs("#pageTitle").textContent = state.adminToken ? "Operations workspace" : "Admin access";
  }
  const capabilities = new Set(staffCapabilities[state.currentUser?.role] || []);
  document.querySelectorAll("[data-staff-tool]").forEach((element) => {
    element.classList.toggle("locked-area", !capabilities.has(element.dataset.staffTool));
  });
  updateAdminTabs();
}

function updateAdminTabs() {
  const tabs = [...document.querySelectorAll("[data-admin-tab]")];
  const panels = [...document.querySelectorAll("[data-admin-panel]")];
  if (!tabs.length || !panels.length) return;
  const visibleTabs = tabs.filter((tab) => {
    const target = tab.dataset.adminTab;
    const matchingPanels = panels.filter((panel) => panel.dataset.adminPanel === target);
    const hasVisiblePanel = matchingPanels.some((panel) => !panel.classList.contains("locked-area"));
    tab.classList.toggle("locked-area", !hasVisiblePanel);
    return hasVisiblePanel;
  });
  if (!visibleTabs.some((tab) => tab.dataset.adminTab === state.adminTab)) {
    state.adminTab = visibleTabs[0]?.dataset.adminTab || "overview";
  }
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.adminTab === state.adminTab));
  panels.forEach((panel) => {
    const active = panel.dataset.adminPanel === state.adminTab;
    panel.classList.toggle("admin-panel-hidden", !active);
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
    await loadStaffData();
    renderAll();
    updateAdminGate();
  } catch (error) {
    toast(error.message, "error");
  }
}

function wireForms() {
  qs("#publicRegister").addEventListener("click", () => {
    openRegistration("Worker");
  });
  qs("#publicSignIn").addEventListener("click", () => {
    openPublicSignIn();
  });
  qs("#publicLogout").addEventListener("click", () => {
    state.publicToken = "";
    state.publicUser = null;
    removeStoredPublicSession();
    renderAll();
    toast("Signed out.");
  });
  qs("#adminLogout").addEventListener("click", () => {
    clearAdminSession();
    renderAll();
    toast("Admin signed out.");
  });
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.adminTab = button.dataset.adminTab;
      updateAdminTabs();
    });
  });
  window.addEventListener("hashchange", showPage);

  document.querySelectorAll("[data-role-choice]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedRole = card.dataset.roleChoice;
      renderRoleExperience();
    });
  });

  qs("#registerPrev").addEventListener("click", () => {
    state.registerStep = Math.max(1, state.registerStep - 1);
    updateRegisterStep();
  });

  qs("#registerNext").addEventListener("click", () => {
    if (!validateRegisterStep()) return;
    state.registerStep = Math.min(registerStepCount, state.registerStep + 1);
    updateRegisterStep();
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
          identityDocumentType: form.get("identityDocumentType"),
          identityDocumentNumber: form.get("identityDocumentNumber"),
          address: form.get("address"),
          country: form.get("country"),
          city: form.get("city"),
          language: form.get("language"),
          currency: form.get("currency"),
          timezone: form.get("timezone"),
          preferredContactMethod: form.get("preferredContactMethod"),
          skills: splitList(form.get("skills") || ""),
          experience: form.get("experience"),
          availability: form.get("availability"),
          salaryExpectation: form.get("salaryExpectation"),
          emergencyContact: form.get("emergencyContact"),
          companyType: form.get("companyType"),
          employerNeeds: form.get("employerNeeds"),
          paymentPreference: form.get("paymentPreference"),
          agencyName: form.get("agencyName"),
          licenseNumber: form.get("licenseNumber"),
          coverageArea: form.get("coverageArea"),
          commissionTerms: form.get("commissionTerms"),
        }),
      });
      const username = form.get("username");
      formElement.reset();
      resetRegisterStep();
      toast("Account created. Sign in with your username and password.");
      await loadAll();
      openPublicSignIn(username);
    } catch (error) {
      if (error.message.includes("Admin login")) {
        clearAdminSession();
      }
      toast(error.message, "error");
    }
  });
  qs("#registerForm select[name='role']").addEventListener("change", updateIdentityDocumentRequirement);
  updateIdentityDocumentRequirement();
  updateRegisterStep();

  qs("#jobForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request("/api/jobs", {
        method: "POST",
        headers: publicAuthHeaders(),
        body: JSON.stringify({
          title: form.get("title"),
          employer: form.get("employer"),
          location: form.get("location"),
          category: form.get("category"),
          skills: splitList(form.get("skills") || ""),
          salary: form.get("salary"),
          currency: form.get("currency"),
        }),
      });
      formElement.reset();
      toast("Job published.");
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  qs("#placementForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request("/api/placements", {
        method: "POST",
        headers: publicAuthHeaders(),
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
    } catch (error) {
      toast(error.message, "error");
    }
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
          country: form.get("country"),
          language: form.get("language"),
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
          mfaCode: form.get("mfaCode"),
        }),
      });
      state.adminToken = session.token;
      state.currentUser = session.user;
      writeStoredAdminToken(session.token);
      formElement.reset();
      await loadStaffData();
      renderAll();
      updateAdminGate();
      toast(`${session.user.role} signed in.`);
    } catch (error) {
      toast(error.message, "error");
    }
  });

  qs("#passwordResetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request("/api/auth/password-reset", {
        method: "POST",
        headers: { "X-Admin-Token": state.adminToken },
        body: JSON.stringify({
          username: form.get("username"),
          newPassword: form.get("newPassword"),
        }),
      });
      formElement.reset();
      toast("Password reset completed.");
      await loadAll();
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
      if (staffRoles.includes(session.user.role)) {
        toast("Staff accounts must use the private staff portal.", "error");
        return;
      }
      state.publicToken = session.token;
      state.publicUser = session.user;
      writeStoredPublicSession(session.token, session.user);
      formElement.reset();
      qs("#publicLoginForm").classList.add("hidden");
      await loadAccountData();
      renderAll();
      toast(`${session.user.role} signed in.`);
    } catch (error) {
      toast(error.message, "error");
    }
  });

  qs("#forgotPasswordToggle").addEventListener("click", openForgotPassword);
  qs("#forgotPasswordCancel").addEventListener("click", openPublicSignIn);

  qs("#forgotPasswordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          requester: form.get("requester"),
          topic: "Password reset request",
          priority: "High",
          details: `${form.get("role")} account. Contact: ${form.get("contact")}`,
        }),
      });
      formElement.reset();
      qs("#forgotPasswordForm").classList.add("hidden");
      qs("#publicLoginForm").classList.remove("hidden");
      toast("Password help request sent. Staff will verify your identity before resetting it.");
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  qs("#talentProfileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request("/api/talents", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          contact: form.get("contact"),
          category: form.get("category"),
          country: form.get("country"),
          education: form.get("education"),
          skills: splitList(form.get("skills") || ""),
          achievements: form.get("achievements"),
          evidence: form.get("evidence"),
        }),
      });
      formElement.reset();
      toast("Talent profile submitted for review.");
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  qs("#talentOpportunityForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request("/api/talent-opportunities", {
        method: "POST",
        body: JSON.stringify({
          provider: form.get("provider"),
          title: form.get("title"),
          opportunityType: form.get("opportunityType"),
          category: form.get("category"),
          country: form.get("country"),
          deadline: form.get("deadline"),
          educationLevel: form.get("educationLevel"),
          skills: splitList(form.get("skills") || ""),
          eligibility: form.get("eligibility"),
        }),
      });
      formElement.reset();
      toast("Opportunity submitted for review.");
      await loadAll();
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

  qs("#paymentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request("/api/payments", {
        method: "POST",
        headers: publicAuthHeaders(),
        body: JSON.stringify({
          payer: form.get("payer"),
          amount: form.get("amount"),
          currency: form.get("currency"),
          method: form.get("method"),
        }),
      });
      formElement.reset();
      toast("Invoice created.");
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  qs("#complianceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await request("/api/compliance/requests", {
      method: "POST",
      body: JSON.stringify({
        requester: form.get("requester"),
        requestType: form.get("requestType"),
        details: form.get("details"),
      }),
    });
    formElement.reset();
    toast("Compliance request submitted.");
    await loadAll();
  });

  qs("#safetyForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await request("/api/safety/reports", {
      method: "POST",
      body: JSON.stringify({
        reporter: form.get("reporter"),
        reportType: form.get("reportType"),
        details: form.get("details"),
      }),
    });
    formElement.reset();
    toast("Safety report submitted.");
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
