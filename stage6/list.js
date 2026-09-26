import {
  getJobCache,
  getListingContext
} from "../core/storage.js";

const $ = (selector) => document.querySelector(selector);

const els = {
  listingTitle: $("#listingTitle"),
  listingMeta: $("#listingMeta"),
  listingStatus: $("#listingStatus"),
  totalCount: $("#totalCount"),
  relevantCount: $("#relevantCount"),
  reviewCount: $("#reviewCount"),
  filteredCount: $("#filteredCount"),
  analyzedCount: $("#analyzedCount"),
  openSourceBtn: $("#openSourceBtn"),
  searchInput: $("#searchInput"),
  jobList: $("#jobList"),
  emptyState: $("#emptyState")
};

let context = null;
let cache = {};
let mode = "recommended";
let query = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function comparableUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return (url.hostname + url.pathname).toLowerCase().replace(/\/+$/, "");
  } catch (_) {
    return String(value || "").toLowerCase().split("?")[0].replace(/\/+$/, "");
  }
}

function cachedFor(job) {
  if (job?.key && cache[job.key]) return cache[job.key];

  const id = String(job?.portalJobId || "");
  const url = comparableUrl(job?.canonicalUrl);

  for (const item of Object.values(cache)) {
    if (!item || item.portal !== job?.portal) continue;

    if (
      id &&
      item.portalJobId &&
      String(item.portalJobId) === id
    ) {
      return item;
    }

    if (url && comparableUrl(item.canonicalUrl) === url) {
      return item;
    }
  }

  return null;
}

function enrichedJobs() {
  return (context?.jobs || []).map((job) => {
    const cached = cachedFor(job);
    return {
      ...job,
      aiAnalysis: cached?.aiAnalysis || null,
      deepMatch: cached?.deepMatch || null
    };
  });
}

function decisionRank(job) {
  const action = job.deepMatch?.applyDecision?.action;
  if (action === "APPLY") return 0;
  if (action === "REVIEW FIRST") return 1;
  if (!job.deepMatch && job.relevance?.status === "relevant") return 2;
  if (!job.deepMatch && job.relevance?.status === "review") return 3;
  if (action === "SKIP") return 5;
  return 4;
}

function score(job) {
  const value = job.deepMatch?.matchScore?.score;
  return Number.isFinite(value) ? value : -1;
}

function visible(job) {
  const status = job.relevance?.status || "review";
  const analyzed = Boolean(job.deepMatch);

  if (mode === "relevant") return status === "relevant";
  if (mode === "review") return status === "review";
  if (mode === "analyzed") return analyzed;
  if (mode === "recommended") return status !== "filtered";
  return true;
}

function matchesQuery(job) {
  if (!query) return true;

  const haystack = [
    job.title,
    job.company,
    job.location,
    job.experienceText,
    ...(job.skills || [])
  ].join(" ").toLowerCase();

  return haystack.includes(query);
}

function badgeFor(job) {
  const decision = job.deepMatch?.applyDecision?.action;

  if (decision) {
    const cls =
      decision === "APPLY"
        ? "apply"
        : decision === "SKIP"
          ? "skip"
          : "review";

    return '<span class="badge ' + cls + '">' +
      escapeHtml(decision) +
    '</span>';
  }

  const status = job.relevance?.status || "review";
  const label =
    status === "relevant"
      ? "HIGH PRIORITY"
      : status === "filtered"
        ? "LOW PRIORITY"
        : "REVIEW";

  return '<span class="badge ' + status + '">' +
    label +
  '</span>';
}

function render() {
  const jobs = enrichedJobs()
    .filter(visible)
    .filter(matchesQuery)
    .sort((a, b) => {
      const rankDiff = decisionRank(a) - decisionRank(b);
      if (rankDiff) return rankDiff;
      return score(b) - score(a);
    });

  const all = enrichedJobs();
  const analyzed = all.filter((job) => job.deepMatch).length;

  els.totalCount.textContent = context?.jobs?.length || 0;
  els.relevantCount.textContent = context?.relevanceStats?.relevant || 0;
  els.reviewCount.textContent = context?.relevanceStats?.review || 0;
  els.filteredCount.textContent = context?.relevanceStats?.filtered || 0;
  els.analyzedCount.textContent = analyzed;

  els.emptyState.classList.toggle(
    "hidden",
    Boolean(context?.jobs?.length)
  );

  els.jobList.innerHTML = jobs.map((job) => {
    const matchScore = job.deepMatch?.matchScore?.score;
    const reasons = job.relevance?.reasons || [];

    return '<article class="job">' +
      '<div class="job-head">' +
        '<div>' +
          '<h3>' + escapeHtml(job.title || "Untitled job") + '</h3>' +
          '<div class="company">' + escapeHtml(job.company || "Company unknown") + '</div>' +
        '</div>' +
        '<div class="badges">' +
          badgeFor(job) +
          (Number.isFinite(matchScore)
            ? '<span class="badge score">' + matchScore + '% MATCH</span>'
            : '') +
        '</div>' +
      '</div>' +

      '<div class="meta">' +
        '<div><span>Experience</span><strong>' + escapeHtml(job.experienceText || "Unknown") + '</strong></div>' +
        '<div><span>Location</span><strong>' + escapeHtml(job.location || "Unknown") + '</strong></div>' +
        '<div><span>Salary</span><strong>' + escapeHtml(job.salaryText || "Unknown") + '</strong></div>' +
        '<div><span>Posted</span><strong>' + escapeHtml(job.postedAge || "Unknown") + '</strong></div>' +
      '</div>' +

      '<div class="skills">' +
        (job.skills || []).slice(0, 10).map((skill) =>
          '<span class="skill">' + escapeHtml(skill) + '</span>'
        ).join("") +
      '</div>' +

      '<div class="reason">' +
        escapeHtml(
          reasons[0] ||
          (job.deepMatch
            ? "Deep analysis available on the job page."
            : "Open the job for full JobPilot analysis.")
        ) +
      '</div>' +

      '<div class="job-actions">' +
        '<span class="deep-note">' +
          (job.deepMatch
            ? "Previously deep analyzed"
            : "Deep analysis runs on the portal page") +
        '</span>' +
        '<a class="open" href="' + escapeHtml(job.canonicalUrl || "#") + '" target="_blank" rel="noopener">Open job →</a>' +
      '</div>' +
    '</article>';
  }).join("");
}

async function load() {
  [context, cache] = await Promise.all([
    getListingContext(),
    getJobCache()
  ]);

  const hasList = Boolean(context?.jobs?.length);

  els.listingStatus.textContent =
    hasList ? "Ready" : "Waiting";

  els.listingTitle.textContent =
    hasList
      ? (context.portalName || context.portal || "Job portal") + " · " + context.jobs.length + " jobs"
      : "Waiting for a job listing…";

  els.listingMeta.textContent =
    hasList
      ? "Captured " + new Date(context.capturedAt).toLocaleString()
      : "Open a supported search-results page to capture jobs.";

  els.openSourceBtn.disabled = !context?.sourceUrl;

  render();
}

els.openSourceBtn.addEventListener("click", async () => {
  if (!context?.sourceUrl) return;
  await chrome.tabs.create({ url: context.sourceUrl });
});

for (const button of document.querySelectorAll("[data-mode]")) {
  button.addEventListener("click", () => {
    mode = button.dataset.mode || "recommended";

    for (const item of document.querySelectorAll("[data-mode]")) {
      item.classList.toggle("active", item === button);
    }

    render();
  });
}

els.searchInput.addEventListener("input", () => {
  query = els.searchInput.value.trim().toLowerCase();
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    (
      changes["jobpilot.stage6.listingContext"] ||
      changes["jobpilot.jobs.cache"]
    )
  ) {
    load().catch(() => {});
  }
});

load().catch((error) => {
  els.listingTitle.textContent = "Could not load JobPilot list";
  els.listingMeta.textContent = error?.message || String(error);
  els.listingStatus.textContent = "Error";
});