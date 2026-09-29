import { analysisRevision } from "./core/analysis-inputs.js";
import "./core/portal-engine.js";
import { runStorageOperation, persistPortalCapture, toggleJobApplied } from "./core/storage.js";
import { beginAuth, authStatus, acceptBridge, isExtensionPage } from "./core/auth-bridge.js";
// Remove legacy persistent credentials. New credentials live only in trusted session storage.
chrome.storage.local.remove(["jobpilot.puter.token", "jobpilot.puter.ai.authorized"]);
chrome.runtime.onMessageExternal.addListener((message, sender, respond) => {
  acceptBridge(message, sender).then(respond, () => respond({ ok: false }));
  return true;
});
import {
  getAiAuthorized,
  getAppliedJobs,
  getGapInsights,
  getJobCache,
  getPuterToken,
  isJobApplied,
  getPreferences,
  getState,
  markJobApplied,
  saveJobAiAnalysis,
  saveJobAiRankings,
  saveJobDeepMatch,
  unmarkJobApplied
} from "./core/storage.js";
import {
  analyzeJobBatchForCandidate,
  analyzeJobWithAi
} from "./core/puter-client.js";
import { evaluateDeepMatch } from "./core/match-engine.js";

const SETUP_PAGE = "onboarding/onboarding.html";
const PREFERENCES_PAGE = "preferences/preferences.html";
const SEARCH_HUB_PAGE = "stage3/naukri.html";
const JOB_LIST_PAGE = "stage6/list.html";

const STATE_KEY = "jobpilot.stage1.state";
const PREFERENCES_KEY = "jobpilot.stage2.preferences";
const NAUKRI_SEARCH_KEY = "jobpilot.stage3.naukriSearch";
const PORTAL_CAPTURE_KEY = "jobpilot.stage4.portalCapture";
const LISTING_CONTEXT_KEY = "jobpilot.stage6.listingContext";
const INJECTION_STATUS_KEY = "jobpilot.portal.injectionStatus";

const COMMON_PORTAL_FILES = [
  "core/portal-engine.js"
];

const PORTAL_FILE_MAP = {
  naukri: [
    "portals/naukri/listing.js",
    "portals/naukri/detail.js",
    "portals/naukri/adapter.js"
  ],
  foundit: [
    "portals/shared/portal-utils.js",
    "portals/foundit/listing.js",
    "portals/foundit/detail.js",
    "portals/foundit/adapter.js"
  ],
  linkedin: [
    "portals/shared/portal-utils.js",
    "portals/linkedin/listing.js",
    "portals/linkedin/detail.js",
    "portals/linkedin/adapter.js"
  ],
  indeed: [
    "portals/shared/portal-utils.js",
    "portals/indeed/listing.js",
    "portals/indeed/detail.js",
    "portals/indeed/adapter.js"
  ],
  hirist: [
    "portals/shared/portal-utils.js",
    "portals/hirist/listing.js",
    "portals/hirist/detail.js",
    "portals/hirist/adapter.js"
  ]
};

const COMMON_RUNTIME_FILES = [
  "core/relevance-gate.js",
  "content/portal-runtime.js",
  "content/detail-intelligence.js"
];

const STARTUP_PORTAL_URLS = [
  "https://naukri.com/*",
  "https://www.naukri.com/*",
  "https://*.naukri.com/*",
  "https://foundit.in/*",
  "https://www.foundit.in/*",
  "https://*.foundit.in/*",
  "https://www.linkedin.com/jobs/*",
  "https://*.linkedin.com/jobs/*",
  "https://in.indeed.com/*",
  "https://www.indeed.com/*",
  "https://*.indeed.com/*",
  "https://hirist.tech/*",
  "https://www.hirist.tech/*"
];

function getPortalIdFromUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    if (host === "naukri.com" || host.endsWith(".naukri.com")) {
      return "naukri";
    }

    if (host === "foundit.in" || host.endsWith(".foundit.in")) {
      return "foundit";
    }

    if (
      (host === "linkedin.com" || host.endsWith(".linkedin.com")) &&
      path.startsWith("/jobs")
    ) {
      return "linkedin";
    }

    if (host === "indeed.com" || host.endsWith(".indeed.com")) {
      return "indeed";
    }

    if (host === "hirist.tech" || host.endsWith(".hirist.tech")) {
      return "hirist";
    }

    return "";
  } catch (_) {
    return "";
  }
}

function isSupportedPortalUrl(value) {
  return Boolean(getPortalIdFromUrl(value));
}

function openPage(path) {
  chrome.tabs.create({ url: chrome.runtime.getURL(path) });
}

function comparableJobUrl(value) {
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

function findCachedJob(cache, incoming) {
  return Object.values(cache || {}).find(job => globalThis.JobPilotPortalEngine.sameJob(job, incoming)) || null;
}

async function calculateInlineIntelligence(incomingJob, forceAi = false) {
  if (!incomingJob || !incomingJob.title) {
    throw new Error("The detail job is not ready yet.");
  }

  const [
    state,
    preferences,
    token,
    aiAuthorized,
    cache
  ] = await Promise.all([
    getState(),
    getPreferences(),
    getPuterToken(),
    getAiAuthorized(),
    getJobCache()
  ]);

  if (!state?.profile) {
    throw new Error("Save your Stage 1 profile first.");
  }

  if (!preferences?.updatedAt) {
    throw new Error("Save Stage 2 preferences first.");
  }

  const cached = findCachedJob(cache, incomingJob);

  let job = globalThis.JobPilotPortalEngine.mergeJob(cached, incomingJob);

  const inputRevision = analysisRevision(state.profile, preferences, job);
  if (job.aiAnalysis?.inputRevision !== inputRevision) job.aiAnalysis = null;
  const descriptionLength = String(job.description || "").trim().length;
  const fullJdReady = Boolean(
    job.status?.detailLoaded &&
    descriptionLength >= 80
  );
  let aiStatus = job.aiAnalysis
    ? "cached"
    : token && aiAuthorized && !fullJdReady
      ? "waiting-for-jd"
      : "local";

  // Persist the latest detail before AI so the cached recommendation is tied
  // to the same JD revision that produced it.
  if (fullJdReady && job.portal) {
    await persistPortalCapture({
      portal: job.portal,
      pageType: "detail",
      jobs: [],
      detail: job
    });
  }

  // Full job-detail pages automatically run AI once when Puter is connected.
  // Manual Refresh can force AI even if the portal exposed a shorter JD.
  // Cached analysis is reused until the profile/preferences/JD revision changes.
  if (token && aiAuthorized && (fullJdReady || forceAi) && (!job.aiAnalysis || forceAi)) {
    try {
      const analysis = await analyzeJobWithAi(job, state.profile, preferences);
      const current = await getState();
      const currentPreferences = await getPreferences();
      if (analysisRevision(current.profile, currentPreferences, job) !== inputRevision) throw new Error("Profile changed during analysis. Refresh this job.");
      job = { ...job, aiAnalysis: analysis, aiAnalyzedAt: analysis.analyzedAt };
      await saveJobAiAnalysis(job.key, analysis);
      aiStatus = "completed";
    } catch (error) {
      aiStatus = "unavailable";
      job.aiError = error?.message || "AI unavailable";
    }
  }

  const deepMatch = evaluateDeepMatch(
    state.profile,
    preferences,
    job
  );

  deepMatch.inputs = {
    profileUpdatedAt: state.updatedAt || null,
    preferencesUpdatedAt: preferences.updatedAt || null,
    jobCapturedAt: job.capturedAt || null,
    aiAnalyzedAt: job.aiAnalyzedAt || null
  };

  job = {
    ...job,
    deepMatch,
    deepMatchedAt: deepMatch.evaluatedAt
  };

  await saveJobDeepMatch(job.key, deepMatch);

  const applied = await isJobApplied(job);

  return {
    job,
    match: deepMatch,
    applied,
    aiStatus,
    aiError: job.aiError || "",
    puterReady: Boolean(token && aiAuthorized)
  };
}


function normalizeProfileText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function profileContains(text, value) {
  const needle = normalizeProfileText(value);
  if (!needle || needle.length < 2) return false;
  return (" " + text + " ").includes(" " + needle + " ") || text.includes(needle);
}

async function buildProfileOptimization(page = {}) {
  const [state, preferences, appliedStore, gaps] = await Promise.all([
    getState(),
    getPreferences(),
    getAppliedJobs(),
    getGapInsights(30)
  ]);

  if (!state?.profile) throw new Error("Save your JobPilot profile first.");

  const text = normalizeProfileText(page.text || "");
  if (text.length < 80) throw new Error("Not enough visible profile text was found on this page.");

  const applied = Object.values(appliedStore?.items || {})
    .filter(item => item?.status === "applied")
    .sort((a,b) => String(b.appliedAt || "").localeCompare(String(a.appliedAt || "")))
    .slice(0, 60);

  const frequency = new Map();
  for (const job of applied) {
    for (const raw of job.skills || []) {
      const skill = String(raw || "").trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      const row = frequency.get(key) || { skill, count: 0 };
      row.count += 1;
      frequency.set(key, row);
    }
  }

  const topAppliedSkills = [...frequency.values()]
    .sort((a,b) => b.count - a.count || a.skill.localeCompare(b.skill))
    .slice(0, 24);

  const savedSkills = [...new Set((state.profile.skills || []).map(x => String(x || "").trim()).filter(Boolean))];
  const targetRoles = [...new Set((preferences.targetRoles || []).map(x => String(x || "").trim()).filter(Boolean))];

  const savedCovered = savedSkills.filter(skill => profileContains(text, skill));
  const frequentCovered = topAppliedSkills.filter(row => profileContains(text, row.skill));
  const roleCovered = targetRoles.filter(role => profileContains(text, role));

  const savedCoverage = savedSkills.length ? savedCovered.length / Math.min(savedSkills.length, 30) : 0;
  const frequentWeight = topAppliedSkills.reduce((sum,row) => sum + row.count, 0);
  const frequentCoveredWeight = frequentCovered.reduce((sum,row) => sum + row.count, 0);
  const marketCoverage = frequentWeight ? frequentCoveredWeight / frequentWeight : 0;
  const roleCoverage = targetRoles.length ? roleCovered.length / targetRoles.length : 0;

  const hasSummarySignal = /summary|about|profile|overview/.test(text);
  const hasExperienceSignal = /experience|employment|work history|professional/.test(text);
  const hasSkillsSignal = /skills|key skills|technical skills/.test(text);
  const completeness = [hasSummarySignal, hasExperienceSignal, hasSkillsSignal].filter(Boolean).length / 3;

  const score = Math.max(0, Math.min(100, Math.round(
    savedCoverage * 35 +
    marketCoverage * 35 +
    roleCoverage * 20 +
    completeness * 10
  )));

  const missingButOwned = savedSkills
    .filter(skill => !profileContains(text, skill))
    .filter(skill => topAppliedSkills.some(row => row.skill.toLowerCase() === skill.toLowerCase()))
    .slice(0, 10);

  const frequentMissing = topAppliedSkills
    .filter(row => !profileContains(text, row.skill))
    .slice(0, 10);

  const learningTargets = [
    ...(gaps?.missingRequired || []).map(x => ({...x, kind:"required"})),
    ...(gaps?.missingPreferred || []).map(x => ({...x, kind:"preferred"}))
  ]
    .sort((a,b) => (b.count || 0) - (a.count || 0))
    .filter((item,index,array) =>
      array.findIndex(x => String(x.value).toLowerCase() === String(item.value).toLowerCase()) === index
    )
    .slice(0, 10);

  const headlineSkills = savedSkills
    .filter(skill => topAppliedSkills.some(row => row.skill.toLowerCase() === skill.toLowerCase()))
    .slice(0, 4);

  const suggestedHeadline = [
    targetRoles[0] || state.profile.currentRole || "Frontend Developer",
    ...headlineSkills
  ].filter(Boolean).join(" | ");

  const ideas = [];
  if (!roleCovered.length && targetRoles.length) {
    ideas.push("Use your primary target role wording in the headline or About section: " + targetRoles.slice(0,2).join(" / ") + ".");
  }
  if (missingButOwned.length) {
    ideas.push("You already have these skills in JobPilot but they are hard to find on this profile: " + missingButOwned.slice(0,6).join(", ") + ".");
  }
  if (frequentMissing.length) {
    ideas.push("Frequently seen in your applied jobs but not visible on this page: " + frequentMissing.slice(0,6).map(x=>x.skill).join(", ") + ". Add only the ones you genuinely use.");
  }
  if (!hasSummarySignal) ideas.push("Strengthen the profile summary/About section with role, years of experience, strongest frontend skills and measurable work.");
  if (!hasSkillsSignal) ideas.push("Make the Skills/Key Skills section explicit so recruiter keyword search can find your real capabilities.");

  return {
    score,
    label: score >= 80 ? "Strong coverage" : score >= 65 ? "Good, improve keywords" : score >= 45 ? "Needs optimization" : "Low profile coverage",
    portal: String(page.portal || ""),
    analyzedAt: new Date().toISOString(),
    evidence: {
      appliedJobsUsed: applied.length,
      savedSkills: savedSkills.length,
      savedSkillsVisible: savedCovered.length,
      recurringAppliedSkills: topAppliedSkills.length,
      recurringSkillsVisible: frequentCovered.length,
      targetRoles: targetRoles.length,
      targetRolesVisible: roleCovered.length
    },
    suggestedHeadline,
    missingButOwned,
    frequentMissing,
    learningTargets,
    ideas
  };
}

const inlineRequests = new Map();
async function buildInlineIntelligence(job, forceAi = false) {
  const state = await getState();
  const preferences = await getPreferences();
  const key = analysisRevision(state.profile, preferences, job) + ":" + forceAi;
  if (!inlineRequests.has(key)) {
    const pending = calculateInlineIntelligence(job, forceAi).finally(() => inlineRequests.delete(key));
    inlineRequests.set(key, pending);
  }
  return inlineRequests.get(key);
}

async function setInjectionStatus(payload) {
  try {
    await chrome.storage.local.set({
      [INJECTION_STATUS_KEY]: {
        ...payload,
        at: new Date().toISOString()
      }
    });
  } catch (_) {}
}

async function injectJobPilotIntoPortal(tabId, url, reason = "background") {
  const portalId = getPortalIdFromUrl(url);

  if (!tabId || !portalId) {
    return false;
  }

  const portalFiles = PORTAL_FILE_MAP[portalId] || [];
  const files = [
    ...COMMON_PORTAL_FILES,
    ...portalFiles,
    ...COMMON_RUNTIME_FILES
  ];

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["content/portal-runtime.css"]
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files
    });

    await setInjectionStatus({
      ok: true,
      tabId,
      url,
      reason,
      error: ""
    });

    return true;
  } catch (error) {
    await setInjectionStatus({
      ok: false,
      tabId,
      url,
      reason,
      error: error?.message || String(error)
    });

    console.warn("JobPilot portal injection failed", error);
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  const respond = promise => {
    promise.then(value => sendResponse({ ok: true, ...value }), error => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  };
  if (message?.type === "jobpilot:auth-begin") return respond(beginAuth(sender).then(state => ({ state })));
  if (message?.type === "jobpilot:auth-status") return respond(authStatus(message.state, sender));
  if (message?.type === "jobpilot:storage") {
    if (!isExtensionPage(sender)) { sendResponse({ ok: false, error: "Storage access denied." }); return false; }
    return respond(runStorageOperation(message.name, message.args).then(value => ({ value })));
  }
  if (!isExtensionPage(sender) && !isSupportedPortalUrl(sender.url)) return false;
  if (message?.type === "jobpilot:capture") return respond(persistPortalCapture(message.data).then(() => ({})));

  if (message?.type === "jobpilot:toggle-applied") {
    (async () => {
      try {
        const job = message.job;

        if (!job) {
          throw new Error("Job data is required.");
        }

        const result = await toggleJobApplied(job, { source: message.source || "job-detail" });
        sendResponse({ ok: true, ...result });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error?.message || String(error)
        });
      }
    })();

    return true;
  }

  if (message?.type === "jobpilot:rank-list-ai") {
    (async () => {
      try {
        const [state, preferences] = await Promise.all([
          getState(),
          getPreferences()
        ]);

        if (!state?.profile) {
          throw new Error("Save your Stage 1 profile first.");
        }

        if (!preferences?.updatedAt) {
          throw new Error("Save your Stage 2 preferences first.");
        }

        const cache = await getJobCache();
        const jobs = [...new Set((Array.isArray(message.jobs) ? message.jobs : []).map(job=>job?.key))]
          .slice(0, 2).map(key=>cache[key]).filter(Boolean);
        if (!jobs.length) throw new Error("No captured jobs are available to analyze.");
        const rankings = await analyzeJobBatchForCandidate(state.profile, preferences, jobs);
        const saved = await saveJobAiRankings(rankings);
        if (rankings.some(row=>saved[row.key]?.aiRanking?.inputRevision !== row.inputRevision)) throw new Error("Your profile or job details changed during analysis. Run the agent again.");
        sendResponse({
          ok: true,
          rankings,
          count: rankings.length
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error?.message || String(error)
        });
      }
    })();

    return true;
  }

  if (message?.type === "jobpilot:profile-optimize") {
    return respond(buildProfileOptimization(message.page || {}).then(result => ({ result })));
  }

  if (message?.type === "jobpilot:inline-analyze") {
    (async () => {
      try {
        const result = await buildInlineIntelligence(
          message.job,
          message.forceAi === true
        );
        sendResponse({ ok: true, ...result });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error?.message || String(error)
        });
      }
    })();

    return true;
  }


  return false;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    openPage(SETUP_PAGE);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    injectJobPilotIntoPortal(tabId, tab.url, "tab-complete");
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({
      url: STARTUP_PORTAL_URLS
    });

    for (const tab of tabs) {
      if (tab.id && tab.url) {
        await injectJobPilotIntoPortal(tab.id, tab.url, "browser-startup");
      }
    }
  } catch (error) {
    await setInjectionStatus({
      ok: false,
      url: "",
      reason: "browser-startup-query",
      error: error?.message || String(error)
    });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  // A toolbar click grants activeTab access for the current page.
  // Force-inject JobPilot on any supported portal tab.
  if (tab?.id && isSupportedPortalUrl(tab.url)) {
    await injectJobPilotIntoPortal(
      tab.id,
      tab.url,
      "toolbar-activeTab"
    );
  }

  const result = await chrome.storage.local.get([
    STATE_KEY,
    PREFERENCES_KEY,
    NAUKRI_SEARCH_KEY,
    PORTAL_CAPTURE_KEY,
    LISTING_CONTEXT_KEY
  ]);

  const hasProfile = Boolean(
    result[STATE_KEY] &&
    result[STATE_KEY].profile
  );

  const preferences = result[PREFERENCES_KEY];
  const hasPreferences = Boolean(
    preferences &&
    preferences.updatedAt &&
    Array.isArray(preferences.targetRoles) &&
    preferences.targetRoles.length
  );

  const search = result[NAUKRI_SEARCH_KEY];
  const hasSearch = Boolean(search && search.createdAt);

  const listingContext = result[LISTING_CONTEXT_KEY];
  const hasListing = Boolean(
    listingContext &&
    Array.isArray(listingContext.jobs) &&
    listingContext.jobs.length
  );

  if (!hasProfile) {
    openPage(SETUP_PAGE);
    return;
  }

  if (!hasPreferences) {
    openPage(PREFERENCES_PAGE);
    return;
  }

  if (hasListing) {
    openPage(JOB_LIST_PAGE);
    return;
  }

  // Search setup is the only extension page needed before a list exists.
  // Detail analysis stays on the portal website itself.
  openPage(SEARCH_HUB_PAGE);
});
