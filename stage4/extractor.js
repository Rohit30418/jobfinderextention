import {
  clearNaukriExtraction,
  getNaukriExtraction,
  getNaukriSearch,
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
  diagnosticsGrid: $("#diagnosticsGrid")
};

let extraction = null;

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
  const detected = Number(stats.detected || 0);
  const parsed = Number(stats.parsed || 0);

  els.detectedCount.textContent = detected;
  els.parsedCount.textContent = parsed;
  els.failedCount.textContent = Math.max(0, detected - parsed);
  els.highCount.textContent = Number(stats.high || 0);
  els.mediumCount.textContent = Number(stats.medium || 0);
  els.lowCount.textContent = Number(stats.low || 0);
}

function renderCards(cards) {
  els.cardsPanel.classList.toggle("hidden", !cards.length);
  els.cardCountChip.textContent = cards.length + " job" + (cards.length === 1 ? "" : "s");

  els.jobList.innerHTML = cards.map((job) => {
    const confidence = job.extraction || { level: "LOW", score: 0, missing: [] };
    const fields = [
      ["Experience", job.experience],
      ["Location", job.location],
      ["Salary", job.salary],
      ["Posted", job.postedAge]
    ];

    return (
      '<article class="job-card">' +
        '<div class="job-head">' +
          '<div>' +
            '<h3>' + escapeHtml(display(job.title)) + '</h3>' +
            '<div class="job-company">' + escapeHtml(display(job.company)) + '</div>' +
          '</div>' +
          '<div class="confidence ' + confidenceClass(confidence.level) + '">' +
            escapeHtml(confidence.level) + ' ' + Number(confidence.score || 0) + '/100' +
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
        (job.descriptionSnippet
          ? '<div class="snippet">' + escapeHtml(job.descriptionSnippet) + '</div>'
          : '') +
        '<div class="missing-line">Missing: ' +
          escapeHtml(
            confidence.missing && confidence.missing.length
              ? confidence.missing.join(", ")
              : "none"
          ) +
        '</div>' +
        (job.jobUrl
          ? '<a class="job-link" href="' + escapeHtml(job.jobUrl) + '" target="_blank" rel="noreferrer">Open Naukri job ↗</a>'
          : '') +
      '</article>'
    );
  }).join("");
}

function renderDetail(job) {
  els.detailPanel.classList.toggle("hidden", !job);
  if (!job) return;

  const confidence = job.extraction || { level: "LOW", score: 0, missing: [] };
  els.detailTitle.textContent = job.title || "Structured job detail";
  els.detailConfidence.textContent =
    confidence.level + " " + Number(confidence.score || 0) + "/100";
  els.detailConfidence.className =
    "confidence-chip " + confidenceClass(confidence.level);

  const fields = [
    ["Company", job.company, ""],
    ["Experience", job.experience, ""],
    ["Location", job.location, ""],
    ["Salary", job.salary, ""],
    ["Posted age", job.postedAge, ""],
    ["Date posted", job.datePosted, ""],
    ["Employment type", job.employmentType, ""],
    ["Education", job.education, ""],
    ["Job ID", job.jobId, ""],
    ["Skills", Array.isArray(job.skills) ? job.skills.join(", ") : job.skills, "wide"],
    ["Job URL", job.jobUrl, "wide"],
    [
      "Missing fields",
      confidence.missing && confidence.missing.length
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
  const search = await getNaukriSearch();
  const data = extraction || await getNaukriExtraction();

  const diagnostics = [
    ["Stage 1 profile", Boolean(state.profile), state.profile ? "Ready" : "Missing"],
    [
      "Stage 2 preferences",
      Boolean(preferences.updatedAt),
      preferences.updatedAt ? "Saved" : "Missing"
    ],
    [
      "Stage 3 search",
      Boolean(search.createdAt),
      search.createdAt ? "Stored" : "Not opened"
    ],
    [
      "Stage 4 page type",
      data.pageType === "search-results" || data.pageType === "job-detail",
      data.pageType || "unknown"
    ],
    [
      "Structured jobs",
      Number(data.stats?.parsed || 0) > 0,
      Number(data.stats?.parsed || 0) + " parsed"
    ],
    [
      "Whole-body parsing",
      true,
      "Disabled"
    ],
    [
      "Match scoring",
      true,
      "Disabled"
    ],
    [
      "AI job analysis",
      true,
      "Disabled"
    ]
  ];

  els.diagnosticsGrid.innerHTML = diagnostics.map((item) =>
    '<div class="diag ' + (item[1] ? "pass" : "") + '">' +
      '<strong>' + (item[1] ? "PASS" : "WAIT") + '</strong>' +
      '<span>' + escapeHtml(item[0] + ": " + item[2]) + '</span>' +
    '</div>'
  ).join("");
}

async function render() {
  extraction = await getNaukriExtraction();
  const stats = extraction.stats || {};

  renderMetrics(extraction);

  const validPage =
    extraction.pageType === "search-results" ||
    extraction.pageType === "job-detail";

  els.pageStatus.textContent = validPage ? "Extracted" : "Waiting";
  els.pageStatus.style.color = validPage ? "#a9fac3" : "#8f9db2";

  if (extraction.pageType === "search-results") {
    els.pageTitle.textContent = "Naukri search results extracted";
  } else if (extraction.pageType === "job-detail") {
    els.pageTitle.textContent = "Naukri job detail extracted";
  } else {
    els.pageTitle.textContent = "Waiting for Naukri data...";
  }

  els.pageMeta.textContent = extraction.extractedAt
    ? "Last extraction: " + formatTime(extraction.extractedAt) +
      (extraction.sourceUrl ? " · " + extraction.sourceUrl : "")
    : "Open a Naukri search result or job-detail page.";

  els.openSourceBtn.disabled = !extraction.sourceUrl;

  const cards = Array.isArray(extraction.cards) ? extraction.cards : [];
  renderCards(cards);
  renderDetail(extraction.detail || null);

  const empty =
    extraction.pageType === "unknown" ||
    (Number(stats.parsed || 0) === 0 && !extraction.detail);

  els.emptyPanel.classList.toggle("hidden", !empty);

  await renderDiagnostics();
}

els.openSourceBtn.addEventListener("click", async () => {
  if (extraction?.sourceUrl) {
    await chrome.tabs.create({ url: extraction.sourceUrl });
  }
});

els.refreshBtn.addEventListener("click", render);

els.clearBtn.addEventListener("click", async () => {
  const confirmed = confirm(
    "Clear only the latest Stage 4 extraction data? Stage 1–3 data will remain."
  );
  if (!confirmed) return;

  await clearNaukriExtraction();
  await render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes["jobpilot.stage4.naukriExtraction"]) {
    render().catch(() => {});
  }
});

render().catch((error) => {
  els.pageTitle.textContent = "Stage 4 could not initialize";
  els.pageMeta.textContent = error.message || String(error);
  els.pageStatus.textContent = "Error";
  els.pageStatus.style.color = "#ff8995";
});
