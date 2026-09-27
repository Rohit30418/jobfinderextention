import { DISCOVERY_KEY } from "../core/discovery.js";
import { recommendationFor, compareRecommendations } from "../core/agent-recommendation.js";
import "../core/relevance-gate.js";
import "../core/portal-engine.js";
import {
  addSkillToProfile,
  dismissSkillFromVault,
  exportAppliedJobsData,
  exportJobPilotBackup,
  getAppliedJobs,
  getGapInsights,
  getJobCache,
  getListingContexts,
  getSkillVault,
  getState,
  getPreferences,
  setPreferences,
  importJobPilotBackup,
  undoLastImport,
  markJobApplied,
  removeSkillFromProfile,
  restoreSkillInVault,
  unmarkJobApplied
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
  appliedCount: $("#appliedCount"),
  aiRankBtn: $("#aiRankBtn"),
  aiRankStatus: $("#aiRankStatus"),
  openSourceBtn: $("#openSourceBtn"),
  portalSources: $("#portalSources"),
  portalFilters: $("#portalFilters"),
  searchInput: $("#searchInput"),
  jobList: $("#jobList"),
  emptyState: $("#emptyState"),
  insightSummary: $("#insightSummary"),
  insightStatus: $("#insightStatus"),
  missingRequiredInsights: $("#missingRequiredInsights"),
  missingPreferredInsights: $("#missingPreferredInsights"),
  skillVaultStatus: $("#skillVaultStatus"),
  skillVaultList: $("#skillVaultList"),
  vaultMissingCount: $("#vaultMissingCount"),
  vaultAddedCount: $("#vaultAddedCount"),
  vaultDismissedCount: $("#vaultDismissedCount"),
  exportBackupBtn: $("#exportBackupBtn"),
  importBackupBtn: $("#importBackupBtn"),
  importBackupInput: $("#importBackupInput"),
  appliedStatus: $("#appliedStatus"),
  appliedSummary: $("#appliedSummary"),
  appliedList: $("#appliedList"),
  exportAppliedCsvBtn: $("#exportAppliedCsvBtn"),
  exportAppliedJsonBtn: $("#exportAppliedJsonBtn")
};

let contextsState = {
  version: 1,
  portals: {},
  updatedAt: null
};

let cache = {};
let discoveryKeys = [];
let insights = null;
let skillVault = { version: 1, items: {}, updatedAt: null };
let profileState = null;
let currentPreferences = {};
let appliedJobsState = { version: 1, items: {}, updatedAt: null };
let vaultMode = "missing";
let mode = "recommended";
let portalMode = "all";
let query = "";
let latestContext = null;
let agentRunning = false;
let agentStopped = false;
let agentTimer;
let agentError = "";

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
  return Object.values(cache).find(item => globalThis.JobPilotPortalEngine.sameJob(item, job)) || null;
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
        ...(cached || {}),
        relevance: globalThis.JobPilotRelevanceGate.evaluate(job, currentPreferences),
        portal: job.portal || context.portal || "",
        portalName:
          context.portalName ||
          context.portal ||
          job.portal ||
          "",
        listingCapturedAt: context.capturedAt || null,
        aiAnalysis: cached?.aiAnalysis || null,
        aiRanking: cached?.aiRanking || null,
        deepMatch: cached?.deepMatch || null
      });
    }
  }

  for(const key of discoveryKeys) {
    const job=cache[key];
    if(job && !seen.has(key)){seen.add(key);output.push({...job,portalName:portalMeta(job.portal).name,relevance:globalThis.JobPilotRelevanceGate.evaluate(job,currentPreferences)});}
  }
  return output;
}

function score(job) { return recommendationFor(job)?.fitScore ?? -1; }
function visible(job) {
  if (portalMode !== 'all' && job.portal !== portalMode) return false;
  const rec = recommendationFor(job);
  if (mode === 'recommended' || mode === 'relevant') return rec?.decision === 'APPLY';
  if (mode === 'review') return rec?.decision === 'REVIEW';
  if (mode === 'pending') return !rec;
  if (mode === 'skip') return rec?.decision === 'SKIP';
  if (mode === 'analyzed') return Boolean(rec);
  return true;
}
function agentDetails(job) {
  const rec = recommendationFor(job);
  if (!rec) return '<p class="reason">Waiting for AI analysis. Run the agent to evaluate this job.</p>';
  const section = (title,items) => items.length ? '<strong>'+title+'</strong><ul>'+items.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</ul>' : '';
  return '<details class="agent-explanation"><summary>Why apply / why not · '+escapeHtml(rec.confidence)+' confidence · '+(rec.basis === 'LISTING' ? 'Listing only' : 'Job description')+'</summary>'+
    section('Why apply',rec.reasons)+section('Why not / gaps',rec.gaps)+section('Confirmed conflicts',rec.hardBlockers.map(x=>x.explanation))+
    section('Check before applying',rec.unknowns)+section('Evidence',rec.evidence.map(x=>'Your profile: “'+x.candidateQuote+'” · Job: “'+x.jobQuote+'” — '+x.explanation))+
    '<p>'+escapeHtml(rec.nextStep)+'</p><small>Estimated fit, not an interview or selection probability.</small></details>';
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
  const recommendation = recommendationFor(job);
  return '<span class="badge '+(recommendation?.decision === 'APPLY' ? 'apply' : recommendation?.decision === 'SKIP' ? 'skip' : 'review')+'">'+escapeHtml(recommendation?.decision || 'PENDING AI')+'</span>';
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



function appliedItems() {
  return Object.values(appliedJobsState?.items || {})
    .filter((item) => item?.status === "applied")
    .sort((a, b) =>
      String(b.appliedAt || "").localeCompare(
        String(a.appliedAt || "")
      )
    );
}

function jobAppliedRecord(job) {
  if (!job) return null;

  const items = appliedJobsState?.items || {};

  if (job.key && items[job.key]) {
    return items[job.key];
  }

  const portalId = String(job.portalJobId || "");
  const url = comparableUrl(job.canonicalUrl);

  for (const item of Object.values(items)) {
    if (!item) continue;

    if (
      portalId &&
      item.portalJobId &&
      String(item.portalJobId) === portalId &&
      item.portal === job.portal
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

function downloadTextFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  const text = Array.isArray(value)
    ? value.join(", ")
    : String(value ?? "");

  const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function appliedJobsToCsv(items) {
  const headers = [
    "Applied Date",
    "Portal",
    "Job Title",
    "Company",
    "Location",
    "Experience",
    "Salary",
    "Match Score",
    "AI Fit Score",
    "Decision",
    "Verdict",
    "Role Family",
    "Skills",
    "Job URL",
    "Note"
  ];

  const rows = items.map((item) => [
    item.appliedAt
      ? new Date(item.appliedAt).toLocaleString()
      : "",
    item.portalName || item.portal || "",
    item.title || "",
    item.company || "",
    item.location || "",
    item.experienceText || "",
    item.salaryText || "",
    Number.isFinite(item.matchScore) ? item.matchScore : "",
    Number.isFinite(item.aiFitScore) ? item.aiFitScore : "",
    item.decision || "",
    item.verdict || "",
    item.roleFamily || "",
    item.skills || [],
    item.canonicalUrl || "",
    item.note || ""
  ]);

  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(","))
  ].join("\r\n");
}

function renderAppliedJobs() {
  const items = appliedItems();

  if (els.appliedCount) {
    els.appliedCount.textContent = items.length;
  }

  if (els.appliedStatus) {
    els.appliedStatus.textContent =
      items.length + " applied";
  }

  if (els.appliedSummary) {
    els.appliedSummary.textContent =
      items.length
        ? "Your latest applications are saved locally and included in JobPilot backups."
        : "Mark jobs as applied and export the history anytime.";
  }

  if (els.exportAppliedCsvBtn) {
    els.exportAppliedCsvBtn.disabled = !items.length;
  }

  if (els.exportAppliedJsonBtn) {
    els.exportAppliedJsonBtn.disabled = !items.length;
  }

  if (!els.appliedList) return;

  if (!items.length) {
    els.appliedList.innerHTML =
      '<div class="insight-empty">No applied jobs yet. Use “Mark Applied” on a job card or job detail page.</div>';
    return;
  }

  els.appliedList.innerHTML = items
    .slice(0, 8)
    .map((item) => {
      const appliedDate = item.appliedAt
        ? new Date(item.appliedAt).toLocaleString()
        : "Unknown date";

      return (
        '<article class="applied-item">' +
          '<div class="applied-copy">' +
            '<div class="job-source">' +
              escapeHtml(item.portalName || item.portal || "Portal") +
            '</div>' +
            '<strong>' + escapeHtml(item.title || "Untitled job") + '</strong>' +
            '<span>' +
              escapeHtml(item.company || "Company unknown") +
              ' · ' +
              escapeHtml(appliedDate) +
            '</span>' +
          '</div>' +
          '<div class="applied-actions">' +
            (
              item.canonicalUrl
                ? '<a class="vault-action add" href="' +
                    escapeHtml(item.canonicalUrl) +
                    '" target="_blank" rel="noopener">Open</a>'
                : ""
            ) +
            '<button class="vault-action danger" type="button" data-applied-remove="' +
              escapeHtml(item.key || "") +
            '">Undo Applied</button>' +
          '</div>' +
        '</article>'
      );
    })
    .join("");

  for (const button of els.appliedList.querySelectorAll("[data-applied-remove]")) {
    button.addEventListener("click", async () => {
      const key = button.dataset.appliedRemove || "";
      button.disabled = true;

      try {
        await unmarkJobApplied(key);
        await load();
      } catch (error) {
        button.disabled = false;
        button.textContent =
          error?.message || "Could not undo";
      }
    });
  }
}

function vaultItems() {
  return Object.values(skillVault?.items || {})
    .filter((item) => item?.skill);
}

function renderSkillVault() {
  const items = vaultItems();

  const missing = items.filter((item) => (item.status || "missing") === "missing");
  const added = items.filter((item) => item.status === "added");
  const dismissed = items.filter((item) => item.status === "dismissed");

  if (els.skillVaultStatus) {
    els.skillVaultStatus.textContent =
      items.length + " saved · " + (skillVault?.syncStatus === "synced" ? "Sync copy saved" : "Saved on this device; export a backup to transfer") + (skillVault?.syncError ? " · " + skillVault.syncError : "");
  }

  if (els.vaultMissingCount) {
    els.vaultMissingCount.textContent = missing.length;
  }

  if (els.vaultAddedCount) {
    els.vaultAddedCount.textContent = added.length;
  }

  if (els.vaultDismissedCount) {
    els.vaultDismissedCount.textContent = dismissed.length;
  }

  

for (const button of document.querySelectorAll("[data-vault-mode]")) {
    button.classList.toggle(
      "active",
      button.dataset.vaultMode === vaultMode
    );
  }

  const current = items
    .filter((item) => (item.status || "missing") === vaultMode)
    .sort((a, b) => {
      const kindDiff =
        (a.kind === "required" ? 0 : 1) -
        (b.kind === "required" ? 0 : 1);

      if (kindDiff) return kindDiff;

      const countDiff =
        (b.sourceKeys?.length || 0) -
        (a.sourceKeys?.length || 0);

      if (countDiff) return countDiff;

      return String(b.lastSeenAt || "")
        .localeCompare(String(a.lastSeenAt || ""));
    });

  if (!els.skillVaultList) return;

  if (!current.length) {
    els.skillVaultList.innerHTML =
      '<div class="insight-empty">No skills in this section yet.</div>';
    return;
  }

  els.skillVaultList.innerHTML = current.map((item) => {
    const seenCount = item.sourceKeys?.length || 0;
    const portals = (item.portals || [])
      .map((id) => portalMeta(id).name)
      .join(", ");

    let actions = "";

    if (vaultMode === "missing") {
      actions =
        '<button class="vault-action add" type="button" data-vault-add="' +
          escapeHtml(item.skill) +
        '">Add to My Skills</button>' +
        '<button class="vault-action ghost" type="button" data-vault-dismiss="' +
          escapeHtml(item.skill) +
        '">Dismiss</button>';
    } else if (vaultMode === "added") {
      actions =
        '<button class="vault-action danger" type="button" data-vault-remove="' +
          escapeHtml(item.skill) +
        '">Remove from My Skills</button>';
    } else {
      actions =
        '<button class="vault-action ghost" type="button" data-vault-restore="' +
          escapeHtml(item.skill) +
        '">Restore to Missing</button>';
    }

    return (
      '<article class="vault-item">' +
        '<div class="vault-copy">' +
          '<div class="vault-topline">' +
            '<strong>' + escapeHtml(item.skill) + '</strong>' +
            '<span class="vault-kind ' + escapeHtml(item.kind || "required") + '">' +
              escapeHtml((item.kind || "required").toUpperCase()) +
            '</span>' +
          '</div>' +
          '<span>' +
            (
              seenCount
                ? "Seen in " + seenCount + " analyzed job" + (seenCount === 1 ? "" : "s")
                : "Manually saved"
            ) +
            (
              portals
                ? " · " + escapeHtml(portals)
                : ""
            ) +
          '</span>' +
        '</div>' +
        '<div class="vault-actions">' +
          actions +
        '</div>' +
      '</article>'
    );
  }).join("");

  for (const button of els.skillVaultList.querySelectorAll("[data-vault-add]")) {
    button.addEventListener("click", async () => {
      const skill = button.dataset.vaultAdd || "";
      button.disabled = true;
      button.textContent = "Adding…";
      try {
        await addSkillToProfile(skill);
        await load();
      } catch (error) {
        button.disabled = false;
        button.textContent = error?.message || "Could not add";
      }
    });
  }

  for (const button of els.skillVaultList.querySelectorAll("[data-vault-remove]")) {
    button.addEventListener("click", async () => {
      const skill = button.dataset.vaultRemove || "";
      button.disabled = true;
      button.textContent = "Removing…";
      try {
        await removeSkillFromProfile(skill);
        await load();
      } catch (error) {
        button.disabled = false;
        button.textContent = error?.message || "Could not remove";
      }
    });
  }

  for (const button of els.skillVaultList.querySelectorAll("[data-vault-dismiss]")) {
    button.addEventListener("click", async () => {
      const skill = button.dataset.vaultDismiss || "";
      button.disabled = true;
      try {
        await dismissSkillFromVault(skill);
        await load();
      } catch (_) {
        button.disabled = false;
      }
    });
  }

  for (const button of els.skillVaultList.querySelectorAll("[data-vault-restore]")) {
    button.addEventListener("click", async () => {
      const skill = button.dataset.vaultRestore || "";
      button.disabled = true;
      try {
        await restoreSkillInVault(skill);
        await load();
      } catch (_) {
        button.disabled = false;
      }
    });
  }
}

function renderJobs() {
  const all = allCapturedJobs();

  const jobs = all
    .filter(visible)
    .filter(matchesQuery)
    .sort((a,b)=>compareRecommendations(a,b) || String(b.listingCapturedAt || '').localeCompare(String(a.listingCapturedAt || '')));

  const analyzed = all.filter(job=>recommendationFor(job)).length;
  const relevant = all.filter(job=>recommendationFor(job)?.decision === 'APPLY').length;
  const review = all.filter(job=>recommendationFor(job)?.decision === 'REVIEW').length;
  const filtered = all.filter(job=>recommendationFor(job)?.decision === 'SKIP').length;

  els.totalCount.textContent = all.length;
  els.relevantCount.textContent = relevant;
  els.reviewCount.textContent = review;
  els.filteredCount.textContent = filtered;
  els.analyzedCount.textContent = analyzed;

  els.emptyState.classList.toggle(
    "hidden",
    Boolean(jobs.length)
  );

  els.jobList.innerHTML = jobs.map((job) => {
    const matchScore = recommendationFor(job)?.fitScore;
    const reasons =
      recommendationFor(job)?.reasons?.length
        ? recommendationFor(job).reasons
        : job.relevance?.reasons || [];

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
                  "/100 EST. FIT" +
                  "</span>"
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
                : job.aiRanking?.summary
                  ? job.aiRanking.summary
                  : "Open the job for full JobPilot analysis."
            )
          ) +
        "</div>" +

        agentDetails(job) +
        '<div class="job-actions">' +
          '<span class="deep-note">' +
            (
              job.deepMatch
                ? "Previously deep analyzed"
                : job.aiRanking
                  ? "AI ranked · open for full JD analysis"
                  : "Deep analysis runs on the portal page"
            ) +
          "</span>" +
          '<div class="job-action-buttons">' +
            '<button class="vault-action ' +
              (jobAppliedRecord(job) ? "danger" : "add") +
              '" type="button" data-job-applied="' +
              escapeHtml(job.key || job.canonicalUrl || "") +
            '">' +
              (jobAppliedRecord(job) ? "Undo Applied" : "Mark Applied") +
            '</button>' +
            '<a class="open" href="' +
              escapeHtml(job.canonicalUrl || "#") +
              '" target="_blank" rel="noopener">' +
              "Open job →" +
            "</a>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }).join("");

  for (const button of els.jobList.querySelectorAll("[data-job-applied]")) {
    button.addEventListener("click", async () => {
      const identity = button.dataset.jobApplied || "";
      const job = all.find((item) =>
        item.key === identity ||
        item.canonicalUrl === identity
      );

      if (!job) return;

      button.disabled = true;

      try {
        const existing = jobAppliedRecord(job);

        if (existing) {
          await unmarkJobApplied(existing.key);
        } else {
          await markJobApplied(job, {
            source: "job-list"
          });
        }

        await load();
      } catch (error) {
        button.disabled = false;
        button.textContent =
          error?.message || "Could not update";
      }
    });
  }
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

  const aiRanked = all.filter(job=>recommendationFor(job)).length;
  if (els.aiRankStatus && !agentRunning) {
    els.aiRankStatus.textContent = agentError || (
      aiRanked
        ? aiRanked + " job" + (aiRanked === 1 ? "" : "s") + " AI-ranked. Recommended is sorted by fit."
        : "Run the AI agent to build your shortlist. Unanalyzed jobs are in Pending.");
  }

  if (els.aiRankBtn) {
    els.aiRankBtn.disabled = agentRunning || !all.length;
  }
}

function render() {
  renderHeader();
  renderPortalSources();
  renderPortalFilters();
  renderInsights();
  renderAppliedJobs();
  renderSkillVault();
  renderJobs();
}

async function load() {
  [contextsState, cache, insights, skillVault, profileState, appliedJobsState, currentPreferences] =
    await Promise.all([
      getListingContexts(),
      getJobCache(),
      getGapInsights(7),
      getSkillVault(),
      getState(),
      getAppliedJobs(),
      getPreferences()
    ]);

  discoveryKeys = (await chrome.storage.local.get(DISCOVERY_KEY))[DISCOVERY_KEY]?.jobs || [];
  document.querySelector('#agentAuto').checked = currentPreferences.agentEnabled === true;
  render();
  if (currentPreferences.agentEnabled && !agentRunning && !agentStopped && !agentError) {
    clearTimeout(agentTimer);
    agentTimer = setTimeout(()=>{if(currentPreferences.agentEnabled && !agentStopped) runAgent();}, 800);
  }
}




els.exportAppliedCsvBtn?.addEventListener("click", async () => {
  try {
    const items = await exportAppliedJobsData();
    if (!items.length) return;

    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      "jobpilot-applied-jobs-" + stamp + ".csv",
      appliedJobsToCsv(items),
      "text/csv;charset=utf-8"
    );
  } catch (error) {
    if (els.appliedSummary) {
      els.appliedSummary.textContent =
        error?.message || "Could not export applied jobs.";
    }
  }
});

els.exportAppliedJsonBtn?.addEventListener("click", async () => {
  try {
    const items = await exportAppliedJobsData();
    if (!items.length) return;

    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      "jobpilot-applied-jobs-" + stamp + ".json",
      JSON.stringify(
        {
          type: "jobpilot-applied-jobs",
          version: 1,
          exportedAt: new Date().toISOString(),
          count: items.length,
          jobs: items
        },
        null,
        2
      ),
      "application/json"
    );
  } catch (error) {
    if (els.appliedSummary) {
      els.appliedSummary.textContent =
        error?.message || "Could not export applied jobs.";
    }
  }
});

els.exportBackupBtn?.addEventListener("click", async () => {
  try {
    const payload = await exportJobPilotBackup();
    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);

    anchor.href = url;
    anchor.download = "jobpilot-backup-" + stamp + ".json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    if (els.skillVaultStatus) {
      els.skillVaultStatus.textContent =
        error?.message || "Backup failed";
    }
  }
});

els.importBackupBtn?.addEventListener("click", () => {
  els.importBackupInput?.click();
});

els.importBackupInput?.addEventListener("change", async () => {
  const file = els.importBackupInput.files?.[0];
  if (!file) return;

  try {
    if (file.size > 20 * 1024 * 1024) throw new Error("Backup is too large (maximum 20 MB).");
    const text = await file.text();
    const payload = JSON.parse(text);
    await importJobPilotBackup(payload);

    if (els.skillVaultStatus) {
      els.skillVaultStatus.textContent = "Backup restored";
    }

    await load();
  } catch (error) {
    if (els.skillVaultStatus) {
      els.skillVaultStatus.textContent =
        error?.message || "Restore failed";
    }
  } finally {
    els.importBackupInput.value = "";
  }
});

for (const button of document.querySelectorAll("[data-vault-mode]")) {
  button.addEventListener("click", () => {
    vaultMode = button.dataset.vaultMode || "missing";
    renderSkillVault();
  });
}

async function runAgent() {
  if (agentRunning) return;
  const jobs = allCapturedJobs().filter(job=>!recommendationFor(job) && !jobAppliedRecord(job));
  if (!jobs.length) return;
  agentRunning = true; agentStopped = false; agentError = '';
  els.aiRankBtn.disabled = true;
  els.aiRankBtn.textContent = 'Analyzing…';
  document.querySelector('#agentStopBtn').disabled = false;
  let completed = 0;
  try {
    for (let index=0; index<jobs.length && !agentStopped; index+=2) {
      els.aiRankStatus.textContent = 'AI agent: '+completed+' / '+jobs.length+' jobs analyzed. You can stop after the current batch.';
      const response = await chrome.runtime.sendMessage({type:'jobpilot:rank-list-ai',jobs:jobs.slice(index,index+2).map(job=>({key:job.key}))});
      if (!response?.ok) throw new Error(response?.error || 'AI unavailable. Your jobs are saved; retry when connected.');
      completed += response.count;
      await load();
    }
  } catch(error) { agentError = error?.message || String(error); }
  finally {
    agentRunning = false;
    els.aiRankBtn.disabled = false; els.aiRankBtn.textContent = 'Run AI Agent';
    document.querySelector('#agentStopBtn').disabled = true;
    if(currentPreferences.agentEnabled && !agentStopped && !agentError) await load();
    els.aiRankStatus.textContent = agentError || (agentStopped ? 'Agent paused. ' : 'Analysis complete. ')+completed+' jobs analyzed. Strong matches are in Recommended; uncertain jobs are in Review.';
  }
}
els.aiRankBtn?.addEventListener('click', ()=>{agentStopped=false;agentError='';runAgent();});
document.querySelector('#agentStopBtn')?.addEventListener('click',()=>{agentStopped=true;els.aiRankStatus.textContent='Stopping after the current request…';});
document.querySelector('#agentAuto')?.addEventListener('change',async event=>{
  const enabled=event.target.checked;
  clearTimeout(agentTimer); agentStopped=!enabled;
  try {
    await setPreferences({...currentPreferences,agentEnabled:enabled,automaticAi:enabled});
    agentStopped=!enabled; agentError=''; await load();
    if(enabled) runAgent();
  } catch(error) {event.target.checked=!enabled;els.aiRankStatus.textContent=error.message;}
});


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
        changes[DISCOVERY_KEY] ||
        changes["jobpilot.stage6.listingContexts"] ||
        changes["jobpilot.jobs.cache"] ||
        changes["jobpilot.insights.gapHistory"] ||
        changes["jobpilot.skills.vault"] ||
        changes["jobpilot.jobs.applied"] ||
        changes["jobpilot.stage1.state"] ||
        changes["jobpilot.stage2.preferences"]
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

document.getElementById("undoImportBtn")?.addEventListener("click", async () => {
  try { await undoLastImport(); await load(); els.skillVaultStatus.textContent = "Last restore undone"; }
  catch (error) { els.skillVaultStatus.textContent = error?.message || "Could not undo restore"; }
});
