import {
  clearPortalCapture,
  getJobCache,
  getPortalCapture,
  getPreferences,
  getState
} from "../core/storage.js";

const $ = (selector) => document.querySelector(selector);

const els = {
  pageTitle: $("#pageTitle"),
  pageMeta: $("#pageMeta"),
  pageStatus: $("#pageStatus"),
  detectedCount: $("#detectedCount"),
  parsedCount: $("#parsedCount"),
  failedCount: $("#failedCount"),
  highCount: $("#highCount"),
  mediumCount: $("#mediumCount"),
  lowCount: $("#lowCount"),
  openSourceBtn: $("#openSourceBtn"),
  refreshBtn: $("#refreshBtn"),
  clearBtn: $("#clearBtn"),
  cardsPanel: $("#cardsPanel"),
  cardCountChip: $("#cardCountChip"),
  jobList: $("#jobList"),
  detailPanel: $("#detailPanel"),
  detailTitle: $("#detailTitle"),
  detailConfidence: $("#detailConfidence"),
  detailGrid: $("#detailGrid"),
  detailDescription: $("#detailDescription"),
  detailSources: $("#detailSources"),
  emptyPanel: $("#emptyPanel"),
  diagnosticsGrid: $("#diagnosticsGrid"),
  relevanceMode: $("#relevanceMode")
};

let capture = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function display(value) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "Unknown";
  }
  return String(value || "").trim() || "Unknown";
}

function fieldClass(value) {
  const present = Array.isArray(value) ? value.length > 0 : Boolean(value);
  return present ? "field-value" : "field-value unknown";
}

function confidenceClass(level) {
  return String(level || "LOW").toLowerCase();
}

function formatTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function renderMetrics(data) {
  const stats = data.stats || {};
  const relevance = data.relevanceStats || {};
  const detected = Number(stats.detected || 0);

  els.detectedCount.textContent = detected;
  els.parsedCount.textContent = Number(relevance.relevant || 0);
  els.failedCount.textContent = Number(relevance.review || 0);
  els.highCount.textContent = Number(relevance.filtered || 0);
  els.mediumCount.textContent = Number(stats.high || 0);
  els.lowCount.textContent = Number(stats.low || 0);
}

function renderJobs(jobs) {
  const all = Array.isArray(jobs) ? jobs : [];
  const mode = els.relevanceMode?.value || "recommended";

  const list = all.filter((job) => {
    const status = job.relevance?.status || "review";
    if (mode === "all") return true;
    if (mode === "relevant") return status === "relevant";
    if (mode === "review") return status === "review";
    return status !== "filtered";
  });

  els.cardsPanel.classList.toggle("hidden", !all.length);
  els.cardCountChip.textContent =
    list.length + " shown / " + all.length + " extracted";

  els.jobList.innerHTML = list.map((job) => {
    const confidence = job.extraction?.confidence || {
      level: "LOW",
      score: 0,
      missing: []
    };

    const fields = [
      ["Experience", job.experienceText],
      ["Location", job.location],
      ["Salary", job.salaryText],
      ["Posted", job.postedAge]
    ];

    return (
      '<article class="job-card">' +
        '<div class="job-head">' +
          '<div>' +
            '<h3>' + escapeHtml(display(job.title)) + '</h3>' +
            '<div class="job-company">' + escapeHtml(display(job.company)) + '</div>' +
          '</div>' +
          '<div class="confidence ' +
            (job.relevance?.status === "relevant" ? "high" :
             job.relevance?.status === "filtered" ? "low" : "medium") + '">' +
            escapeHtml((job.relevance?.status || "review").toUpperCase()) +
          '</div>' +
        '</div>' +
        '<div class="job-meta">' +
          fields.map(([label, value]) =>
            '<div class="meta">' +
              '<div class="field-label">' + escapeHtml(label) + '</div>' +
              '<div class="' + fieldClass(value) + '">' + escapeHtml(display(value)) + '</div>' +
            '</div>'
          ).join("") +
        '</div>' +
        (Array.isArray(job.skills) && job.skills.length
          ? '<div class="skills">' +
              job.skills.slice(0, 12).map((skill) =>
                '<span class="skill">' + escapeHtml(skill) + '</span>'
              ).join("") +
            '</div>'
          : '') +
        (job.snippet
          ? '<div class="snippet">' + escapeHtml(job.snippet) + '</div>'
          : '') +
        '<div class="missing-line">Why: ' +
          escapeHtml(
            job.relevance?.reasons?.length
              ? job.relevance.reasons.slice(0, 2).join(" · ")
              : "No quick relevance reason available"
          ) +
        '</div>' +
        '<div class="missing-line">Extraction missing: ' +
          escapeHtml(
            confidence.missing?.length
              ? confidence.missing.join(", ")
              : "none"
          ) +
        '</div>' +
        (job.canonicalUrl
          ? '<a class="job-link" href="' + escapeHtml(job.canonicalUrl) + '" target="_blank" rel="noreferrer">Open job ↗</a>'
          : '') +
      '</article>'
    );
  }).join("");
}

function renderDetail(job) {
  els.detailPanel.classList.toggle("hidden", !job);
  if (!job) return;

  const confidence = job.extraction?.confidence || {
    level: "LOW",
    score: 0,
    missing: []
  };

  els.detailTitle.textContent = job.title || "Normalized job detail";
  els.detailConfidence.textContent =
    "Extraction " + confidence.level + " · completeness " +
    Number(confidence.score || 0) + "%";
  els.detailConfidence.className =
    "confidence-chip " + confidenceClass(confidence.level);

  const fields = [
    ["Portal", job.portal, ""],
    ["Company", job.company, ""],
    ["Experience", job.experienceText, ""],
    ["Location", job.location, ""],
    ["Salary", job.salaryText, ""],
    ["Posted age", job.postedAge, ""],
    ["Date posted", job.datePosted, ""],
    ["Employment type", job.employmentType, ""],
    ["Work mode", job.workMode, ""],
    ["Education", job.education, ""],
    ["Portal job ID", job.portalJobId, ""],
    ["Skills", job.skills?.join(", "), "wide"],
    ["Job URL", job.canonicalUrl, "wide"],
    [
      "Missing fields",
      confidence.missing?.length
        ? confidence.missing.join(", ")
        : "None",
      "wide"
    ]
  ];

  els.detailGrid.innerHTML = fields.map(([label, value, wide]) =>
    '<div class="detail-field ' + wide + '">' +
      '<div class="field-label">' + escapeHtml(label) + '</div>' +
      '<div class="' + fieldClass(value) + '">' + escapeHtml(display(value)) + '</div>' +
    '</div>'
  ).join("");

  els.detailDescription.textContent = job.description || "Unknown";

  const sources = job.sources || {};
  els.detailSources.innerHTML =
    '<div class="sources-grid">' +
      Object.entries(sources).map(([field, source]) =>
        '<div class="source-item">' +
          '<b>' + escapeHtml(field) + '</b>' +
          '<span>' + escapeHtml(source || "missing") + '</span>' +
        '</div>'
      ).join("") +
    '</div>';
}

async function renderDiagnostics() {
  const state = await getState();
  const preferences = await getPreferences();
  const data = capture || await getPortalCapture();
  const cache = await getJobCache();
  const connectionResult = await chrome.storage.local.get([
    "jobpilot.stage4.connection"
  ]);
  const connection = connectionResult["jobpilot.stage4.connection"];

  const diagnostics = [
    ["Stage 1 profile", Boolean(state.profile), state.profile ? "Ready" : "Missing"],
    ["Stage 2 preferences", Boolean(preferences.updatedAt), preferences.updatedAt ? "Saved" : "Missing"],
    ["Portal runtime", Boolean(connection?.status === "connected"), connection ? "Connected · " + (connection.portal || "unknown") : "Not connected"],
    ["Portal adapter", Boolean(data.portal), data.portal ? data.portal + " v" + (data.adapterVersion || "?") : "None"],
    ["Page type", data.pageType === "listing" || data.pageType === "detail", data.pageType || "unknown"],
    ["Capture method", data.captureMethod && data.captureMethod !== "none", data.captureMethod || "none"],
    ["Normalized jobs", Number(data.stats?.normalized || 0) > 0, Number(data.stats?.normalized || 0) + " current"],
    ["Job cache", Object.keys(cache).length > 0, Object.keys(cache).length + " cached"],
    ["Match scoring", true, "Disabled"],
    ["AI job analysis", true, "Disabled"]
  ];

  els.diagnosticsGrid.innerHTML = diagnostics.map((item) =>
    '<div class="diag ' + (item[1] ? "pass" : "") + '">' +
      '<strong>' + (item[1] ? "PASS" : "WAIT") + '</strong>' +
      '<span>' + escapeHtml(item[0] + ": " + item[2]) + '</span>' +
    '</div>'
  ).join("");
}

async function render() {
  capture = await getPortalCapture();

  if (
    capture.pageType === "listing" &&
    globalThis.JobPilotRelevanceGate
  ) {
    const preferences = await getPreferences();
    const annotated = globalThis.JobPilotRelevanceGate.annotateJobs(
      capture.jobs || [],
      preferences
    );
    capture.jobs = annotated.jobs;
    capture.relevanceStats = annotated.stats;
  }

  renderMetrics(capture);

  const validPage =
    capture.pageType === "listing" ||
    capture.pageType === "detail";

  els.pageStatus.textContent = validPage ? "Captured" : "Waiting";
  els.pageStatus.style.color = validPage ? "#a9fac3" : "#8f9db2";

  if (capture.pageType === "listing") {
    els.pageTitle.textContent =
      (capture.portalName || capture.portal || "Portal") + " listing captured";
  } else if (capture.pageType === "detail") {
    els.pageTitle.textContent =
      (capture.portalName || capture.portal || "Portal") + " job detail captured";
  } else {
    els.pageTitle.textContent = "Waiting for portal data...";
  }

  els.pageMeta.textContent = capture.capturedAt
    ? "Last capture: " + formatTime(capture.capturedAt) +
      " · " + (capture.portal || "unknown") +
      " · " + (capture.captureMethod || "none") +
      (capture.sourceUrl ? " · " + capture.sourceUrl : "")
    : "Open a supported portal listing or detail page.";

  els.openSourceBtn.disabled = !capture.sourceUrl;

  renderJobs(capture.jobs || []);
  renderDetail(capture.detail || null);

  const empty =
    capture.pageType === "unknown" ||
    (Number(capture.stats?.normalized || 0) === 0 && !capture.detail);

  els.emptyPanel.classList.toggle("hidden", !empty);
  await renderDiagnostics();
}

els.openSourceBtn.addEventListener("click", async () => {
  if (capture?.sourceUrl) {
    await chrome.tabs.create({ url: capture.sourceUrl });
  }
});

els.refreshBtn.addEventListener("click", render);
els.relevanceMode?.addEventListener("change", () => {
  renderJobs(capture?.jobs || []);
});

els.clearBtn.addEventListener("click", async () => {
  const confirmed = confirm(
    "Clear only the latest Stage 4 portal capture? Profile, preferences and cached jobs remain."
  );
  if (!confirmed) return;

  await clearPortalCapture();
  await render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes["jobpilot.stage4.portalCapture"]) {
    render().catch(() => {});
  }
});

render().catch((error) => {
  els.pageTitle.textContent = "Stage 4 could not initialize";
  els.pageMeta.textContent = error.message || String(error);
  els.pageStatus.textContent = "Error";
  els.pageStatus.style.color = "#ff8995";
});
