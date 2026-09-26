import {
  clearPreferences,
  getPreferences,
  getState,
  setPreferences
} from "../core/storage.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  profileGate: $("#profileGate"),
  profileTitle: $("#profileTitle"),
  profileMeta: $("#profileMeta"),
  profileStatus: $("#profileStatus"),
  app: $("#preferencesApp"),
  targetRoles: $("#targetRoles"),
  priorityKeywords: $("#priorityKeywords"),
  preferredLocations: $("#preferredLocations"),
  experienceMin: $("#experienceMin"),
  experienceMax: $("#experienceMax"),
  freshness: $("#freshness"),
  excludedKeywords: $("#excludedKeywords"),
  minimumSalary: $("#minimumSalary"),
  salaryCurrency: $("#salaryCurrency"),
  strictFreshness: $("#strictFreshness"),
  strictExperience: $("#strictExperience"),
  hideExcludedTitles: $("#hideExcludedTitles"),
  savePreferencesBtn: $("#savePreferencesBtn"),
  clearPreferencesBtn: $("#clearPreferencesBtn"),
  saveStatus: $("#saveStatus"),
  formMessage: $("#formMessage"),
  savedSummaryPanel: $("#savedSummaryPanel"),
  savedSummary: $("#savedSummary"),
  diagnosticsGrid: $("#diagnosticsGrid"),
  refreshDiagnosticsBtn: $("#refreshDiagnosticsBtn")
};

let stage1State = null;
let savedPreferences = null;

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

function listText(items) {
  return Array.isArray(items) ? items.filter(Boolean).join("\n") : "";
}

function setMessage(text, type) {
  if (!text) {
    els.formMessage.textContent = "";
    els.formMessage.className = "message hidden";
    return;
  }
  els.formMessage.textContent = text;
  els.formMessage.className = "message" + (type ? " " + type : "");
}

function checkedValues(name) {
  return $$('input[name="' + name + '"]:checked').map((input) => input.value);
}

function setCheckedValues(name, values) {
  const set = new Set(Array.isArray(values) ? values : []);
  $$('input[name="' + name + '"]').forEach((input) => {
    input.checked = set.has(input.value);
  });
}

function nullableNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function seedFromProfile(profile) {
  const profileRoles = Array.isArray(profile.targetRoles) && profile.targetRoles.length
    ? profile.targetRoles
    : profile.currentRole
      ? [profile.currentRole]
      : [];

  const profileKeywords = Array.isArray(profile.resumeKeywords) && profile.resumeKeywords.length
    ? profile.resumeKeywords
    : Array.isArray(profile.skills)
      ? profile.skills.slice(0, 20)
      : [];

  return {
    targetRoles: profileRoles,
    priorityKeywords: profileKeywords,
    preferredLocations: [],
    experienceMin: null,
    experienceMax: null,
    workModes: [],
    employmentTypes: [],
    freshness: "3d",
    excludedKeywords: [],
    minimumSalary: null,
    salaryCurrency: "INR",
    strictFreshness: true,
    strictExperience: false,
    hideExcludedTitles: true
  };
}

function fillForm(pref) {
  els.targetRoles.value = listText(pref.targetRoles);
  els.priorityKeywords.value = listText(pref.priorityKeywords);
  els.preferredLocations.value = listText(pref.preferredLocations);
  els.experienceMin.value = pref.experienceMin ?? "";
  els.experienceMax.value = pref.experienceMax ?? "";
  els.freshness.value = pref.freshness || "3d";
  els.excludedKeywords.value = listText(pref.excludedKeywords);
  els.minimumSalary.value = pref.minimumSalary ?? "";
  els.salaryCurrency.value = pref.salaryCurrency || "INR";
  els.strictFreshness.checked = pref.strictFreshness !== false;
  els.strictExperience.checked = pref.strictExperience === true;
  els.hideExcludedTitles.checked = pref.hideExcludedTitles !== false;
  setCheckedValues("workMode", pref.workModes);
  setCheckedValues("employmentType", pref.employmentTypes);
}

function readForm() {
  return {
    targetRoles: splitList(els.targetRoles.value),
    priorityKeywords: splitList(els.priorityKeywords.value),
    preferredLocations: splitList(els.preferredLocations.value),
    experienceMin: nullableNumber(els.experienceMin.value),
    experienceMax: nullableNumber(els.experienceMax.value),
    workModes: checkedValues("workMode"),
    employmentTypes: checkedValues("employmentType"),
    freshness: els.freshness.value,
    excludedKeywords: splitList(els.excludedKeywords.value),
    minimumSalary: nullableNumber(els.minimumSalary.value),
    salaryCurrency: els.salaryCurrency.value,
    strictFreshness: els.strictFreshness.checked,
    strictExperience: els.strictExperience.checked,
    hideExcludedTitles: els.hideExcludedTitles.checked
  };
}

function validate(pref) {
  const errors = [];

  if (!pref.targetRoles.length) {
    errors.push("Add at least one target role.");
  }

  if (
    pref.experienceMin !== null &&
    (pref.experienceMin < 0 || pref.experienceMin > 60)
  ) {
    errors.push("Minimum experience must be between 0 and 60.");
  }

  if (
    pref.experienceMax !== null &&
    (pref.experienceMax < 0 || pref.experienceMax > 60)
  ) {
    errors.push("Maximum experience must be between 0 and 60.");
  }

  if (
    pref.experienceMin !== null &&
    pref.experienceMax !== null &&
    pref.experienceMin > pref.experienceMax
  ) {
    errors.push("Minimum experience cannot be greater than maximum experience.");
  }

  if (pref.minimumSalary !== null && pref.minimumSalary < 0) {
    errors.push("Minimum salary cannot be negative.");
  }

  return errors;
}

function freshnessLabel(value) {
  return {
    "24h": "Last 24 hours",
    "3d": "Last 3 days",
    "7d": "Last 7 days",
    "14d": "Last 14 days",
    "30d": "Last 30 days",
    "any": "Any time"
  }[value] || value;
}

function experienceLabel(pref) {
  if (pref.experienceMin === null && pref.experienceMax === null) return "No restriction";
  if (pref.experienceMin !== null && pref.experienceMax !== null) {
    return pref.experienceMin + "–" + pref.experienceMax + " years";
  }
  if (pref.experienceMin !== null) return pref.experienceMin + "+ years";
  return "Up to " + pref.experienceMax + " years";
}

function renderSummary(pref) {
  const rows = [
    ["Target roles", pref.targetRoles.join(", "), "wide"],
    ["Priority keywords", pref.priorityKeywords.join(", ") || "No priority keywords", "wide"],
    ["Locations", pref.preferredLocations.join(", ") || "No location restriction", ""],
    ["Experience", experienceLabel(pref), ""],
    ["Freshness", freshnessLabel(pref.freshness), ""],
    ["Work mode", pref.workModes.join(", ") || "Any", ""],
    ["Employment type", pref.employmentTypes.join(", ") || "Any", ""],
    ["Excluded titles", pref.excludedKeywords.join(", ") || "None", "wide"],
    [
      "Minimum salary",
      pref.minimumSalary === null
        ? "Not set"
        : pref.minimumSalary + " " + pref.salaryCurrency,
      ""
    ]
  ];

  els.savedSummary.innerHTML = rows
    .map((row) =>
      '<div class="summary-card ' + row[2] + '">' +
      '<div class="label">' + escapeHtml(row[0]) + '</div>' +
      '<div class="value">' + escapeHtml(row[1]) + '</div>' +
      '</div>'
    )
    .join("");

  els.savedSummaryPanel.classList.remove("hidden");
}

async function refreshDiagnostics() {
  const state = await getState();
  const pref = await getPreferences();

  const diagnostics = [
    ["Stage 1 profile", Boolean(state.profile), state.profile ? "Saved" : "Missing"],
    [
      "Target roles",
      Array.isArray(pref.targetRoles) && pref.targetRoles.length > 0,
      pref.targetRoles && pref.targetRoles.length ? pref.targetRoles.length + " saved" : "Not saved"
    ],
    [
      "Priority keywords",
      Array.isArray(pref.priorityKeywords) && pref.priorityKeywords.length > 0,
      pref.priorityKeywords && pref.priorityKeywords.length ? pref.priorityKeywords.length + " saved" : "Optional / empty"
    ],
    [
      "Locations",
      Array.isArray(pref.preferredLocations) && pref.preferredLocations.length > 0,
      pref.preferredLocations && pref.preferredLocations.length ? pref.preferredLocations.length + " saved" : "No restriction"
    ],
    [
      "Experience range",
      pref.experienceMin !== null || pref.experienceMax !== null,
      experienceLabel(pref)
    ],
    ["Freshness", Boolean(pref.freshness), freshnessLabel(pref.freshness)],
    [
      "Stage 2 persistence",
      Boolean(pref.updatedAt),
      pref.updatedAt ? "Saved locally" : "Not saved yet"
    ],
    [
      "Stage 2",
      Boolean(pref.updatedAt && pref.targetRoles && pref.targetRoles.length),
      pref.updatedAt && pref.targetRoles && pref.targetRoles.length ? "Ready" : "Incomplete"
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
  stage1State = await getState();

  if (!stage1State.profile) {
    els.profileTitle.textContent = "Stage 1 profile is required";
    els.profileMeta.textContent = "Open JobPilot profile setup, save the candidate profile, then return here.";
    els.profileStatus.textContent = "Blocked";
    els.profileStatus.style.color = "#ff9ba5";
    els.app.classList.add("hidden");
    return;
  }

  const profile = stage1State.profile;
  const experienceMonths = Number(profile.totalExperienceMonths || 0);
  const years = Math.floor(experienceMonths / 12);
  const months = experienceMonths % 12;

  els.profileTitle.textContent =
    profile.currentRole || profile.headline || profile.name || "Candidate profile";
  els.profileMeta.textContent =
    (profile.name ? profile.name + " · " : "") +
    years + "y " + months + "m experience · " +
    (Array.isArray(profile.skills) ? profile.skills.length : 0) + " skills";
  els.profileStatus.textContent = "Ready";
  els.profileStatus.style.color = "#a9fac3";
  els.app.classList.remove("hidden");

  const stored = await getPreferences();
  const hasStoredPreferences = Boolean(stored.updatedAt);
  savedPreferences = hasStoredPreferences ? stored : seedFromProfile(profile);

  fillForm(savedPreferences);

  if (hasStoredPreferences) {
    els.saveStatus.textContent = "Saved";
    renderSummary(stored);
  } else {
    els.saveStatus.textContent = "Not saved";
  }

  await refreshDiagnostics();
}

els.savePreferencesBtn.addEventListener("click", async () => {
  const pref = readForm();
  const errors = validate(pref);

  if (errors.length) {
    setMessage(errors.join(" "), "error");
    return;
  }

  els.savePreferencesBtn.disabled = true;

  try {
    savedPreferences = await setPreferences(pref);
    els.saveStatus.textContent = "Saved";
    setMessage(
      "Stage 2 preferences saved locally. Your Stage 1 resume/profile was not changed.",
      "success"
    );
    renderSummary(savedPreferences);
    await refreshDiagnostics();
  } catch (error) {
    setMessage(error.message || "Preferences could not be saved.", "error");
  } finally {
    els.savePreferencesBtn.disabled = false;
  }
});

els.clearPreferencesBtn.addEventListener("click", async () => {
  const confirmed = confirm(
    "Clear only the Stage 2 job preferences? Your saved resume/profile will remain untouched."
  );
  if (!confirmed) return;

  await clearPreferences();
  savedPreferences = seedFromProfile(stage1State.profile);
  fillForm(savedPreferences);
  els.saveStatus.textContent = "Not saved";
  els.savedSummaryPanel.classList.add("hidden");
  setMessage(
    "Stage 2 preferences cleared. Stage 1 profile is still saved.",
    "success"
  );
  await refreshDiagnostics();
});

els.refreshDiagnosticsBtn.addEventListener("click", refreshDiagnostics);

initialize().catch((error) => {
  els.profileTitle.textContent = "Stage 2 could not initialize";
  els.profileMeta.textContent = error.message || String(error);
  els.profileStatus.textContent = "Error";
  els.profileStatus.style.color = "#ff9ba5";
});
