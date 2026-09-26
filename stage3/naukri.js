import {
  getNaukriSearch,
  getPreferences,
  getState,
  setNaukriSearch
} from "../core/storage.js";

const $ = (selector) => document.querySelector(selector);

const els = {
  gateTitle: $("#gateTitle"),
  gateMeta: $("#gateMeta"),
  gateStatus: $("#gateStatus"),
  app: $("#app"),
  primaryRole: $("#primaryRole"),
  keywords: $("#keywords"),
  locations: $("#locations"),
  experienceMin: $("#experienceMin"),
  experienceMax: $("#experienceMax"),
  freshness: $("#freshness"),
  mappingNote: $("#mappingNote"),
  urlPreview: $("#urlPreview"),
  message: $("#message"),
  sessionStatus: $("#sessionStatus"),
  refreshPreviewBtn: $("#refreshPreviewBtn"),
  openNaukriBtn: $("#openNaukriBtn"),
  diagnosticsGrid: $("#diagnosticsGrid"),
  refreshDiagnosticsBtn: $("#refreshDiagnosticsBtn")
};

let profile = null;
let preferences = null;
let lastSearch = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function splitList(value) {
  return [...new Set(
    String(value || "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function setMessage(text, type) {
  if (!text) {
    els.message.textContent = "";
    els.message.className = "message hidden";
    return;
  }
  els.message.textContent = text;
  els.message.className = "message" + (type ? " " + type : "");
}

function freshnessMapping(value) {
  const map = {
    "24h": { jobAge: "1", label: "Last 1 day", approximate: false },
    "3d": { jobAge: "3", label: "Last 3 days", approximate: false },
    "7d": { jobAge: "7", label: "Last 7 days", approximate: false },
    "14d": { jobAge: "15", label: "Naukri 15-day bucket", approximate: true },
    "30d": { jobAge: "30", label: "Last 30 days", approximate: false },
    "any": { jobAge: null, label: "Any time", approximate: false }
  };
  return map[value] || map.any;
}

function nullableInt(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
}

function buildSearchSpec() {
  const role = els.primaryRole.value.trim();
  const keywords = els.keywords.value.trim() || role;
  const locations = splitList(els.locations.value);
  const min = nullableInt(els.experienceMin.value);
  const max = nullableInt(els.experienceMax.value);
  const freshness = els.freshness.value;
  const fresh = freshnessMapping(freshness);

  const params = new URLSearchParams();
  params.set("k", keywords);

  if (locations.length) {
    params.set("l", locations.join(", "));
  }

  if (min !== null || max !== null) {
    if (min !== null && max !== null) {
      params.set("experience", min + "-" + max);
    } else if (min !== null) {
      params.set("experience", String(min));
    } else {
      params.set("experience", "0-" + max);
    }
  }

  if (fresh.jobAge) {
    params.set("jobAge", fresh.jobAge);
  }

  const roleSlug = slugify(role || keywords) || "jobs";
  const primaryLocation = locations.length === 1 ? slugify(locations[0]) : "";
  const path = primaryLocation
    ? "/" + roleSlug + "-jobs-in-" + primaryLocation
    : "/" + roleSlug + "-jobs";

  const url = "https://www.naukri.com" + path + "?" + params.toString();

  return {
    primaryRole: role,
    keywords,
    locations,
    experienceMin: min,
    experienceMax: max,
    requestedFreshness: freshness,
    naukriJobAge: fresh.jobAge,
    url
  };
}

function validateSpec(spec) {
  const errors = [];
  if (!spec.primaryRole) errors.push("Choose a primary role.");
  if (!spec.keywords) errors.push("Search phrase cannot be empty.");
  if (
    spec.experienceMin !== null &&
    spec.experienceMax !== null &&
    spec.experienceMin > spec.experienceMax
  ) {
    errors.push("Minimum experience cannot be greater than maximum experience.");
  }
  return errors;
}

function refreshPreview() {
  const spec = buildSearchSpec();
  const errors = validateSpec(spec);

  els.urlPreview.textContent = spec.url;

  const fresh = freshnessMapping(spec.requestedFreshness);
  if (fresh.approximate) {
    els.mappingNote.textContent =
      "Your Stage 2 preference is about 14 days. Naukri currently uses a 15-day freshness bucket, so JobPilot maps this search to jobAge=15.";
    els.mappingNote.classList.remove("hidden");
  } else {
    els.mappingNote.classList.add("hidden");
  }

  els.openNaukriBtn.disabled = errors.length > 0;
  if (errors.length) {
    setMessage(errors.join(" "), "error");
  } else {
    setMessage("");
  }

  return spec;
}

function fillFromPreferences() {
  const roles = Array.isArray(preferences.targetRoles) ? preferences.targetRoles : [];
  els.primaryRole.innerHTML = roles
    .map((role) => '<option value="' + escapeHtml(role) + '">' + escapeHtml(role) + "</option>")
    .join("");

  if (roles.length) {
    els.primaryRole.value = roles[0];
    els.keywords.value = roles[0];
  }

  els.locations.value = Array.isArray(preferences.preferredLocations)
    ? preferences.preferredLocations.join("\n")
    : "";
  els.experienceMin.value = preferences.experienceMin ?? "";
  els.experienceMax.value = preferences.experienceMax ?? "";
  els.freshness.value = preferences.freshness || "3d";
}

async function refreshDiagnostics() {
  const saved = await getNaukriSearch();
  const diagnostics = [
    ["Stage 1 profile", Boolean(profile), profile ? "Ready" : "Missing"],
    [
      "Stage 2 preferences",
      Boolean(preferences && preferences.updatedAt && preferences.targetRoles && preferences.targetRoles.length),
      preferences && preferences.updatedAt ? "Saved" : "Missing"
    ],
    [
      "Target roles",
      Boolean(preferences && preferences.targetRoles && preferences.targetRoles.length),
      preferences && preferences.targetRoles ? preferences.targetRoles.length + " available" : "None"
    ],
    [
      "Naukri session",
      Boolean(saved && saved.createdAt),
      saved && saved.createdAt ? "Stored" : "Not opened yet"
    ],
    [
      "Generated URL",
      Boolean(saved && saved.url),
      saved && saved.url ? "Available" : "Not generated"
    ],
    [
      "Freshness mapping",
      true,
      freshnessMapping(els.freshness.value).label
    ],
    [
      "Scoring",
      true,
      "Disabled in Stage 3"
    ],
    [
      "AI job analysis",
      true,
      "Disabled in Stage 3"
    ]
  ];

  els.diagnosticsGrid.innerHTML = diagnostics
    .map((item) =>
      '<div class="diag ' + (item[1] ? "pass" : "") + '">' +
      '<strong>' + (item[1] ? "PASS" : "WAIT") + '</strong>' +
      '<span>' + escapeHtml(item[0] + ": " + item[2]) + '</span>' +
      '</div>'
    )
    .join("");
}

async function initialize() {
  const state = await getState();
  preferences = await getPreferences();
  profile = state.profile || null;

  const ready = Boolean(
    profile &&
    preferences &&
    preferences.updatedAt &&
    Array.isArray(preferences.targetRoles) &&
    preferences.targetRoles.length
  );

  if (!ready) {
    els.gateTitle.textContent = "Stage 1 + Stage 2 are required";
    els.gateMeta.textContent = "Save your candidate profile and job preferences first.";
    els.gateStatus.textContent = "Blocked";
    els.gateStatus.style.color = "#ff9ba5";
    els.app.classList.add("hidden");
    return;
  }

  const experienceMonths = Number(profile.totalExperienceMonths || 0);
  const years = Math.floor(experienceMonths / 12);
  const months = experienceMonths % 12;

  els.gateTitle.textContent =
    (profile.currentRole || profile.headline || profile.name || "Candidate") +
    " · Naukri ready";
  els.gateMeta.textContent =
    years + "y " + months + "m profile experience · " +
    preferences.targetRoles.length + " target role(s) · " +
    (preferences.preferredLocations?.length || 0) + " preferred location(s)";
  els.gateStatus.textContent = "Ready";
  els.gateStatus.style.color = "#a9fac3";
  els.app.classList.remove("hidden");

  fillFromPreferences();

  lastSearch = await getNaukriSearch();
  if (lastSearch && lastSearch.createdAt) {
    els.sessionStatus.textContent = "Previous search stored";
  }

  refreshPreview();
  await refreshDiagnostics();
}

els.primaryRole.addEventListener("change", () => {
  els.keywords.value = els.primaryRole.value;
  refreshPreview();
});

["input", "change"].forEach((eventName) => {
  [els.keywords, els.locations, els.experienceMin, els.experienceMax, els.freshness]
    .forEach((element) => element.addEventListener(eventName, refreshPreview));
});

els.refreshPreviewBtn.addEventListener("click", refreshPreview);

els.openNaukriBtn.addEventListener("click", async () => {
  const spec = refreshPreview();
  const errors = validateSpec(spec);
  if (errors.length) return;

  els.openNaukriBtn.disabled = true;

  try {
    lastSearch = await setNaukriSearch(spec);
    els.sessionStatus.textContent = "Search opened";
    setMessage(
      "Naukri opened in a new tab. JobPilot will show a small verification panel on the Naukri page.",
      "success"
    );
    await chrome.tabs.create({ url: spec.url });
    await refreshDiagnostics();
  } catch (error) {
    setMessage(error.message || "Naukri search could not be opened.", "error");
  } finally {
    els.openNaukriBtn.disabled = false;
  }
});

els.refreshDiagnosticsBtn.addEventListener("click", refreshDiagnostics);

initialize().catch((error) => {
  els.gateTitle.textContent = "Stage 3 could not initialize";
  els.gateMeta.textContent = error.message || String(error);
  els.gateStatus.textContent = "Error";
  els.gateStatus.style.color = "#ff9ba5";
});
