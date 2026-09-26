import {
  getGapInsights,
  getJobCache,
  getListingContexts
} from "../core/storage.js";

const $ = (selector) => document.querySelector(selector);

const PORTALS = [
  {
    id: "naukri",
    name: "Naukri",
    url: "https://www.naukri.com/"
  },
  {
    id: "foundit",
    name: "Foundit",
    url: "https://www.foundit.in/"
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    url: "https://www.linkedin.com/jobs/"
  },
  {
    id: "indeed",
    name: "Indeed",
    url: "https://in.indeed.com/"
  },
  {
    id: "hirist",
    name: "Hirist",
    url: "https://www.hirist.tech/"
  }
];

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
  portalSources: $("#portalSources"),
  portalFilters: $("#portalFilters"),
  searchInput: $("#searchInput"),
  jobList: $("#jobList"),
  emptyState: $("#emptyState"),
  insightSummary: $("#insightSummary"),
  insightStatus: $("#insightStatus"),
  missingRequiredInsights: $("#missingRequiredInsights"),
  missingPreferredInsights: $("#missingPreferredInsights")
};

let contextsState = {
  version: 1,
  portals: {},
  updatedAt: null
};

let cache = {};
let insights = null;
let mode = "recommended";
let portalMode = "all";
let query = "";
let latestContext = null;

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
    return (url.hostname + url.pathname)
      .toLowerCase()
      .replace(/\/+$/, "");
  } catch (_) {
    return String(value || "")
      .toLowerCase()
      .split("?")[0]
      .replace(/\/+$/, "");
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

    if (
      url &&
      comparableUrl(item.canonicalUrl) === url
    ) {
      return item;
    }
  }

  return null;
}

function portalContexts() {
  return Object.values(contextsState?.portals || {})
    .filter((item) =>
      item &&
      Array.isArray(item.jobs)
    );
}

function allCapturedJobs() {
  const output = [];
  const seen = new Set();

  for (const context of portalContexts()) {
    for (const job of context.jobs || []) {
      const identity =
        job.key ||
        (
          job.portal +
          "::" +
          (
            job.portalJobId ||
            comparableUrl(job.canonicalUrl)
          )
        );

      if (!identity || seen.has(identity)) continue;
      seen.add(identity);

      const cached = cachedFor(job);

      output.push({
        ...job,
        portal: job.portal || context.portal || "",
        portalName:
          context.portalName ||
          context.portal ||
          job.portal ||
          "",
        listingCapturedAt: context.capturedAt || null,
        aiAnalysis: cached?.aiAnalysis || null,
        deepMatch: cached?.deepMatch || null
      });
    }
  }

  return output;
}

function decisionRank(job) {
  const action = job.deepMatch?.applyDecision?.action;

  if (action === "APPLY") return 0;
  if (action === "REVIEW FIRST") return 1;
  if (!job.deepMatch && job.relevance?.status === "relevant") {
    return 2;
  }
  if (!job.deepMatch && job.relevance?.status === "review") {
    return 3;
  }
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

  if (
    portalMode !== "all" &&
    job.portal !== portalMode
  ) {
    return false;
  }

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
    job.portalName,
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

    return (
      '<span class="badge ' +
      cls +
      '">' +
      escapeHtml(decision) +
      "</span>"
    );
  }

  const status = job.relevance?.status || "review";
  const label =
    status === "relevant"
      ? "HIGH PRIORITY"
      : status === "filtered"
        ? "LOW PRIORITY"
        : "REVIEW";

  return (
    '<span class="badge ' +
    status +
    '">' +
    label +
    "</span>"
  );
}

function portalMeta(id) {
  return PORTALS.find((item) => item.id === id) || {
    id,
    name: id || "Unknown",
    url: ""
  };
}

function latestPortalContext() {
  return portalContexts()
    .slice()
    .sort((a, b) =>
      String(b.capturedAt || "").localeCompare(
        String(a.capturedAt || "")
      )
    )[0] || null;
}

function portalJobCounts() {
  const counts = {};

  for (const job of allCapturedJobs()) {
    counts[job.portal] = (counts[job.portal] || 0) + 1;
  }

  return counts;
}

function renderPortalSources() {
  const counts = portalJobCounts();
  const contexts = contextsState?.portals || {};

  els.portalSources.innerHTML = PORTALS.map((portal) => {
    const context = contexts[portal.id];
    const count = counts[portal.id] || 0;
    const captured = Boolean(context);

    return (
      '<button class="portal-source ' +
      (captured ? "captured" : "") +
      '" type="button" data-open-portal="' +
      escapeHtml(portal.id) +
      '">' +
        '<span class="portal-name">' +
          escapeHtml(portal.name) +
        "</span>" +
        '<strong>' +
          (captured
            ? count + " jobs"
            : "Not captured") +
        "</strong>" +
        '<small>' +
          (captured
            ? "Open latest search"
            : "Open portal") +
        "</small>" +
      "</button>"
    );
  }).join("");

  for (
    const button of
    els.portalSources.querySelectorAll("[data-open-portal]")
  ) {
    button.addEventListener("click", async () => {
      const id = button.dataset.openPortal;
      const portal = portalMeta(id);
      const context = contextsState?.portals?.[id];
      const url = context?.sourceUrl || portal.url;

      if (url) {
        await chrome.tabs.create({ url });
      }
    });
  }
}

function renderPortalFilters() {
  const counts = portalJobCounts();

  const buttons = [
    {
      id: "all",
      name: "All",
      count: allCapturedJobs().length
    },
    ...PORTALS.map((portal) => ({
      id: portal.id,
      name: portal.name,
      count: counts[portal.id] || 0
    }))
  ];

  els.portalFilters.innerHTML = buttons.map((item) =>
    '<button class="filter ' +
      (portalMode === item.id ? "active" : "") +
      '" data-portal-mode="' +
      escapeHtml(item.id) +
      '" type="button">' +
      escapeHtml(item.name) +
      " " +
      item.count +
    "</button>"
  ).join("");

  for (
    const button of
    els.portalFilters.querySelectorAll("[data-portal-mode]")
  ) {
    button.addEventListener("click", () => {
      portalMode =
        button.dataset.portalMode || "all";

      renderPortalFilters();
      renderJobs();
    });
  }
}

function renderInsightItems(element, items, kind) {
  const list = Array.isArray(items) ? items.slice(0, 8) : [];

  if (!list.length) {
    element.innerHTML =
      '<div class="insight-empty">' +
        (
          kind === "required"
            ? "No recurring required-skill gaps yet."
            : "No recurring preferred-skill gaps yet."
        ) +
      "</div>";
    return;
  }

  element.innerHTML = list.map((item, index) => {
    const priority =
      item.count >= 5
        ? "high"
        : item.count >= 2
          ? "medium"
          : "low";

    return (
      '<div class="insight-row">' +
        '<div class="insight-rank">' +
          (index + 1) +
        "</div>" +
        '<div class="insight-copy">' +
          '<strong>' +
            escapeHtml(item.value) +
          "</strong>" +
          '<span>' +
            item.count +
            " analyzed job" +
            (item.count === 1 ? "" : "s") +
            (
              item.portals?.length
                ? " · " +
                  item.portals
                    .map((id) => portalMeta(id).name)
                    .join(", ")
                : ""
            ) +
          "</span>" +
        "</div>" +
        '<span class="gap-priority ' +
          priority +
        '">' +
          (
            priority === "high"
              ? "Frequent"
              : priority === "medium"
                ? "Recurring"
                : "Seen"
          ) +
        "</span>" +
      "</div>"
    );
  }).join("");
}

function renderInsights() {
  const analyzed = insights?.analyzedJobs || 0;

  els.insightStatus.textContent =
    analyzed >= 10
      ? "Useful signal"
      : analyzed > 0
        ? "Learning"
        : "Waiting";

  els.insightSummary.textContent =
    analyzed > 0
      ? (
          "Based on " +
          analyzed +
          " unique job" +
          (analyzed === 1 ? "" : "s") +
          " deep-analyzed in the last " +
          (insights?.days || 7) +
          " days."
        )
      : "Deep-analyze jobs and JobPilot will build a deduplicated weekly profile-gap report.";

  renderInsightItems(
    els.missingRequiredInsights,
    insights?.missingRequired,
    "required"
  );

  renderInsightItems(
    els.missingPreferredInsights,
    insights?.missingPreferred,
    "preferred"
  );
}

function renderJobs() {
  const all = allCapturedJobs();

  const jobs = all
    .filter(visible)
    .filter(matchesQuery)
    .sort((a, b) => {
      const rankDiff =
        decisionRank(a) - decisionRank(b);

      if (rankDiff) return rankDiff;

      const scoreDiff = score(b) - score(a);
      if (scoreDiff) return scoreDiff;

      return String(b.listingCapturedAt || "")
        .localeCompare(
          String(a.listingCapturedAt || "")
        );
    });

  const analyzed = all.filter((job) => job.deepMatch).length;
  const relevant = all.filter(
    (job) => job.relevance?.status === "relevant"
  ).length;
  const review = all.filter(
    (job) =>
      !job.relevance?.status ||
      job.relevance?.status === "review"
  ).length;
  const filtered = all.filter(
    (job) => job.relevance?.status === "filtered"
  ).length;

  els.totalCount.textContent = all.length;
  els.relevantCount.textContent = relevant;
  els.reviewCount.textContent = review;
  els.filteredCount.textContent = filtered;
  els.analyzedCount.textContent = analyzed;

  els.emptyState.classList.toggle(
    "hidden",
    Boolean(all.length)
  );

  els.jobList.innerHTML = jobs.map((job) => {
    const matchScore =
      job.deepMatch?.matchScore?.score;

    const reasons =
      job.relevance?.reasons || [];

    const portalName =
      portalMeta(job.portal).name ||
      job.portalName ||
      job.portal;

    return (
      '<article class="job">' +
        '<div class="job-head">' +
          "<div>" +
            '<div class="job-source">' +
              escapeHtml(portalName) +
            "</div>" +
            "<h3>" +
              escapeHtml(
                job.title || "Untitled job"
              ) +
            "</h3>" +
            '<div class="company">' +
              escapeHtml(
                job.company || "Company unknown"
              ) +
            "</div>" +
          "</div>" +
          '<div class="badges">' +
            badgeFor(job) +
            (
              Number.isFinite(matchScore)
                ? '<span class="badge score">' +
                  matchScore +
                  "% MATCH</span>"
                : ""
            ) +
          "</div>" +
        "</div>" +

        '<div class="meta">' +
          "<div><span>Experience</span><strong>" +
            escapeHtml(job.experienceText || "Unknown") +
          "</strong></div>" +
          "<div><span>Location</span><strong>" +
            escapeHtml(job.location || "Unknown") +
          "</strong></div>" +
          "<div><span>Salary</span><strong>" +
            escapeHtml(job.salaryText || "Unknown") +
          "</strong></div>" +
          "<div><span>Posted</span><strong>" +
            escapeHtml(job.postedAge || "Unknown") +
          "</strong></div>" +
        "</div>" +

        '<div class="skills">' +
          (job.skills || [])
            .slice(0, 10)
            .map((skill) =>
              '<span class="skill">' +
                escapeHtml(skill) +
              "</span>"
            )
            .join("") +
        "</div>" +

        '<div class="reason">' +
          escapeHtml(
            reasons[0] ||
            (
              job.deepMatch
                ? "Deep analysis saved from the portal page."
                : "Open the job for full JobPilot analysis."
            )
          ) +
        "</div>" +

        '<div class="job-actions">' +
          '<span class="deep-note">' +
            (
              job.deepMatch
                ? "Previously deep analyzed"
                : "Deep analysis runs on the portal page"
            ) +
          "</span>" +
          '<a class="open" href="' +
            escapeHtml(job.canonicalUrl || "#") +
            '" target="_blank" rel="noopener">' +
            "Open job →" +
          "</a>" +
        "</div>" +
      "</article>"
    );
  }).join("");
}

function renderHeader() {
  const contexts = portalContexts();
  const all = allCapturedJobs();
  latestContext = latestPortalContext();

  els.listingStatus.textContent =
    all.length ? "Ready" : "Waiting";

  els.listingTitle.textContent =
    all.length
      ? (
          all.length +
          " jobs across " +
          contexts.length +
          " portal" +
          (contexts.length === 1 ? "" : "s")
        )
      : "Waiting for job listings…";

  els.listingMeta.textContent =
    latestContext?.capturedAt
      ? (
          "Latest capture: " +
          new Date(
            latestContext.capturedAt
          ).toLocaleString()
        )
      : "Visit supported portal listing pages and JobPilot will combine them here.";

  els.openSourceBtn.disabled =
    !latestContext?.sourceUrl;
}

function render() {
  renderHeader();
  renderPortalSources();
  renderPortalFilters();
  renderInsights();
  renderJobs();
}

async function load() {
  [contextsState, cache, insights] =
    await Promise.all([
      getListingContexts(),
      getJobCache(),
      getGapInsights(7)
    ]);

  render();
}

els.openSourceBtn.addEventListener(
  "click",
  async () => {
    if (!latestContext?.sourceUrl) return;

    await chrome.tabs.create({
      url: latestContext.sourceUrl
    });
  }
);

for (
  const button of
  document.querySelectorAll("[data-mode]")
) {
  button.addEventListener("click", () => {
    mode =
      button.dataset.mode || "recommended";

    for (
      const item of
      document.querySelectorAll("[data-mode]")
    ) {
      item.classList.toggle(
        "active",
        item === button
      );
    }

    renderJobs();
  });
}

els.searchInput.addEventListener(
  "input",
  () => {
    query =
      els.searchInput.value
        .trim()
        .toLowerCase();

    renderJobs();
  }
);

chrome.storage.onChanged.addListener(
  (changes, area) => {
    if (
      area === "local" &&
      (
        changes["jobpilot.stage6.listingContexts"] ||
        changes["jobpilot.jobs.cache"] ||
        changes["jobpilot.insights.gapHistory"]
      )
    ) {
      load().catch(() => {});
    }
  }
);

load().catch((error) => {
  els.listingTitle.textContent =
    "Could not load JobPilot list";

  els.listingMeta.textContent =
    error?.message || String(error);

  els.listingStatus.textContent = "Error";
});
