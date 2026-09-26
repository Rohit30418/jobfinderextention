import {
  clearNaukriNativeFilters,
  getNaukriNativeFilters,
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
  nativeFilterStatus: $("#nativeFilterStatus"),
  clearNativeFiltersBtn: $("#clearNativeFiltersBtn"),
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
let nativeFilters = null;

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

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function experienceContextKey(min, max) {
  return String(min ?? "") + "|" + String(max ?? "");
}

function locationContextKey(locations) {
  return (Array.isArray(locations) ? locations : [])
    .map(normalizeKey)
    .filter(Boolean)
    .sort()
    .join("|");
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
  return Number.isFinite(number)
    ? Math.max(0, Math.round(number))
    : null;
}

function matchingNativeExperience(min, max) {
  if (!nativeFilters || !nativeFilters.experienceValue) return "";

  return nativeFilters.experienceContextKey === experienceContextKey(min, max)
    ? String(nativeFilters.experienceValue)
    : "";
}

function matchingNativeCities(locations) {
  if (!nativeFilters || !Array.isArray(nativeFilters.cityTypeGids)) return [];

  return nativeFilters.locationContextKey === locationContextKey(locations)
    ? nativeFilters.cityTypeGids.map(String).filter(Boolean)
    : [];
}

function buildSearchSpec() {
  const role = els.primaryRole.value.trim();
  const keywords = els.keywords.value.trim() || role;
  const locations = splitList(els.locations.value);
  const min = nullableInt(els.experienceMin.value);
  const max = nullableInt(els.experienceMax.value);
  const freshness = els.freshness.value;
  const fresh = freshnessMapping(freshness);

  const nativeExperienceValue = matchingNativeExperience(min, max);
  const cityTypeGids = matchingNativeCities(locations);

  const params = new URLSearchParams();

  // Naukri's real search URLs keep explicit query state even when the
  // same role/location are represented in the SEO-friendly path.
  params.set("k", keywords);

  if (locations.length) {
    params.set("l", locations.join(", "));
  }

  if (nativeExperienceValue) {
    params.set("experience", nativeExperienceValue);
  }

  if (fresh.jobAge) {
    params.set("jobAge", fresh.jobAge);
  }

  cityTypeGids.forEach((gid) => params.append("cityTypeGid", gid));

  const roleSlug = slugify(keywords || role) || "jobs";
  const primaryLocation = locations.length ? slugify(locations[0]) : "";

  const path = primaryLocation
    ? "/" + roleSlug + "-jobs-in-" + primaryLocation
    : "/" + roleSlug + "-jobs";

  const query = params.toString();
  const url = "https://www.naukri.com" + path + (query ? "?" + query : "");

  return {
    primaryRole: role,
    keywords,
    locations,
    experienceMin: min,
    experienceMax: max,
    experienceContextKey: experienceContextKey(min, max),
    locationContextKey: locationContextKey(locations),
    requestedFreshness: freshness,
    naukriJobAge: fresh.jobAge,
    nativeExperienceValue,
    cityTypeGids,
    url
  };
}

function validateSpec(spec) {
  const errors = [];

  if (!spec.primaryRole) {
    errors.push("Choose a primary role.");
  }

  if (!spec.keywords) {
    errors.push("Search phrase cannot be empty.");
  }

  if (
    spec.experienceMin !== null &&
    spec.experienceMax !== null &&
    spec.experienceMin > spec.experienceMax
  ) {
    errors.push("Minimum experience cannot be greater than maximum experience.");
  }

  return errors;
}

function renderNativeStatus(spec) {
  const parts = [];

  if (spec.nativeExperienceValue) {
    parts.push(
      "experience=" + spec.nativeExperienceValue +
      " learned for desired range " +
      (spec.experienceMin ?? "any") + "–" + (spec.experienceMax ?? "any")
    );
  } else if (spec.experienceMin !== null || spec.experienceMax !== null) {
    parts.push(
      "Experience is not encoded yet. Open Naukri and apply its native experience filter once; JobPilot will learn the real URL value."
    );
  } else {
    parts.push("No experience restriction requested.");
  }

  if (spec.cityTypeGids.length) {
    parts.push(
      "Learned cityTypeGid values: " +
      spec.cityTypeGids.join(", ")
    );
  } else if (spec.locations.length > 1) {
    parts.push(
      "Only the first location is used in the SEO path until Naukri city filters are learned. Apply the native city filters once to capture repeated cityTypeGid values."
    );
  } else {
    parts.push("No additional Naukri city IDs are currently required.");
  }

  els.nativeFilterStatus.textContent = parts.join(" ");
}

function refreshPreview() {
  const spec = buildSearchSpec();
  const errors = validateSpec(spec);

  els.urlPreview.textContent = spec.url;
  renderNativeStatus(spec);

  const fresh = freshnessMapping(spec.requestedFreshness);

  if (fresh.approximate) {
    els.mappingNote.textContent =
      "Your Stage 2 preference is about 14 days. Naukri uses a 15-day freshness bucket here, so JobPilot maps it to jobAge=15.";
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
  const roles = Array.isArray(preferences.targetRoles)
    ? preferences.targetRoles
    : [];

  els.primaryRole.innerHTML = roles
    .map((role) =>
      '<option value="' + escapeHtml(role) + '">' +
      escapeHtml(role) +
      "</option>"
    )
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
  const spec = buildSearchSpec();
  const connectionResult = await chrome.storage.local.get([
    "jobpilot.stage3.connection",
    "jobpilot.stage4.connection",
    "jobpilot.naukri.injectionStatus"
  ]);
  const stage3Connection = connectionResult["jobpilot.stage3.connection"];
  const stage4Connection = connectionResult["jobpilot.stage4.connection"];
  const injectionStatus = connectionResult["jobpilot.naukri.injectionStatus"];

  const diagnostics = [
    ["Stage 1 profile", Boolean(profile), profile ? "Ready" : "Missing"],
    [
      "Stage 2 preferences",
      Boolean(
        preferences &&
        preferences.updatedAt &&
        preferences.targetRoles &&
        preferences.targetRoles.length
      ),
      preferences && preferences.updatedAt ? "Saved" : "Missing"
    ],
    [
      "URL pattern",
      true,
      "SEO path + k/l + native Naukri filter params"
    ],
    [
      "Freshness",
      true,
      freshnessMapping(els.freshness.value).label
    ],
    [
      "Native experience",
      Boolean(spec.nativeExperienceValue) ||
        (spec.experienceMin === null && spec.experienceMax === null),
      spec.nativeExperienceValue
        ? "experience=" + spec.nativeExperienceValue
        : spec.experienceMin === null && spec.experienceMax === null
          ? "Not requested"
          : "Waiting to learn from Naukri"
    ],
    [
      "Native cities",
      Boolean(spec.cityTypeGids.length) || spec.locations.length <= 1,
      spec.cityTypeGids.length
        ? spec.cityTypeGids.length + " cityTypeGid value(s)"
        : spec.locations.length <= 1
          ? "SEO path only"
          : "Waiting to learn from Naukri"
    ],
    [
      "Naukri session",
      Boolean(saved && saved.createdAt),
      saved && saved.createdAt ? "Stored" : "Not opened yet"
    ],
    [
      "Stage 3 page script",
      Boolean(stage3Connection && stage3Connection.status === "connected"),
      stage3Connection ? "Connected · " + stage3Connection.url : "Not connected to a Naukri tab"
    ],
    [
      "Stage 4 extractor script",
      Boolean(stage4Connection && stage4Connection.status === "connected"),
      stage4Connection ? "Connected · " + stage4Connection.url : "Not connected to a Naukri tab"
    ],
    [
      "Injection attempt",
      Boolean(injectionStatus && injectionStatus.ok === true),
      injectionStatus
        ? injectionStatus.ok
          ? "PASS · " + injectionStatus.reason
          : "FAILED · " + injectionStatus.reason + " · " + (injectionStatus.error || "Unknown error")
        : "No injection attempt recorded"
    ],
    [
      "Scoring / AI",
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

async function reloadNativeFilters() {
  nativeFilters = await getNaukriNativeFilters();
  refreshPreview();
  await refreshDiagnostics();
}

async function initialize() {
  const state = await getState();

  preferences = await getPreferences();
  nativeFilters = await getNaukriNativeFilters();
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
    els.gateMeta.textContent =
      "Save your candidate profile and job preferences first.";
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
    (preferences.preferredLocations?.length || 0) +
    " preferred location(s)";

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
  [
    els.keywords,
    els.locations,
    els.experienceMin,
    els.experienceMax,
    els.freshness
  ].forEach((element) =>
    element.addEventListener(eventName, refreshPreview)
  );
});

els.refreshPreviewBtn.addEventListener("click", refreshPreview);

els.clearNativeFiltersBtn.addEventListener("click", async () => {
  await clearNaukriNativeFilters();
  nativeFilters = await getNaukriNativeFilters();
  setMessage(
    "Learned Naukri experience/city URL values were cleared. Stage 1 and Stage 2 were not changed.",
    "success"
  );
  refreshPreview();
  await refreshDiagnostics();
});

els.openNaukriBtn.addEventListener("click", async () => {
  const spec = refreshPreview();
  const errors = validateSpec(spec);

  if (errors.length) return;

  els.openNaukriBtn.disabled = true;

  try {
    lastSearch = await setNaukriSearch(spec);
    els.sessionStatus.textContent = "Search opened";

    setMessage(
      "Naukri opened. If experience or additional city filters are not learned yet, apply them once on Naukri; JobPilot will capture the real URL values automatically.",
      "success"
    );

    await chrome.tabs.create({ url: spec.url });
    await refreshDiagnostics();
  } catch (error) {
    setMessage(
      error.message || "Naukri search could not be opened.",
      "error"
    );
  } finally {
    els.openNaukriBtn.disabled = false;
  }
});

els.refreshDiagnosticsBtn.addEventListener("click", refreshDiagnostics);

chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    changes["jobpilot.stage3.naukriNativeFilters"]
  ) {
    reloadNativeFilters().catch(() => {});
  }
});

initialize().catch((error) => {
  els.gateTitle.textContent = "Stage 3 could not initialize";
  els.gateMeta.textContent = error.message || String(error);
  els.gateStatus.textContent = "Error";
  els.gateStatus.style.color = "#ff9ba5";
});
