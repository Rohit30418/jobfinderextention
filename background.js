import {
  getAiAuthorized,
  getJobCache,
  getPuterToken,
  getPreferences,
  getState,
  saveJobAiAnalysis,
  saveJobAiRankings,
  saveJobDeepMatch
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
  if (!incoming || !cache) return null;

  if (incoming.key && cache[incoming.key]) {
    return cache[incoming.key];
  }

  const incomingId = String(incoming.portalJobId || "");
  const incomingUrl = comparableJobUrl(incoming.canonicalUrl);

  for (const job of Object.values(cache)) {
    if (!job || job.portal !== incoming.portal) continue;

    if (
      incomingId &&
      job.portalJobId &&
      String(job.portalJobId) === incomingId
    ) {
      return job;
    }

    if (
      incomingUrl &&
      comparableJobUrl(job.canonicalUrl) === incomingUrl
    ) {
      return job;
    }
  }

  return null;
}

async function buildInlineIntelligence(incomingJob, forceAi = false) {
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

  let job = {
    ...(cached || {}),
    ...incomingJob,
    aiAnalysis: cached?.aiAnalysis || incomingJob.aiAnalysis || null,
    aiAnalyzedAt: cached?.aiAnalyzedAt || incomingJob.aiAnalyzedAt || null
  };

  let aiStatus = "not-connected";

  if (token && aiAuthorized) {
    const semanticReady =
      job.aiAnalysis?.analysisVersion >= 2 &&
      Array.isArray(job.aiAnalysis?.candidateRequirementMatches);

    aiStatus =
      job.aiAnalysis && semanticReady && !forceAi
        ? "cached"
        : "analyzing";

    if (!job.aiAnalysis || !semanticReady || forceAi) {
      const analysis = await analyzeJobWithAi(
        job,
        state.profile,
        preferences
      );
      job = {
        ...job,
        aiAnalysis: analysis,
        aiAnalyzedAt: analysis.analyzedAt || new Date().toISOString()
      };

      await saveJobAiAnalysis(job.key, analysis);
      aiStatus = "completed";
    }
  } else if (job.aiAnalysis) {
    aiStatus = "cached";
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

  return {
    job,
    match: deepMatch,
    aiStatus,
    puterReady: Boolean(token && aiAuthorized)
  };
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

        const jobs = Array.isArray(message.jobs)
          ? message.jobs.slice(0, 120)
          : [];

        if (!jobs.length) {
          throw new Error("No captured jobs are available to rank.");
        }

        const rankings = [];
        const batchSize = 20;

        for (let index = 0; index < jobs.length; index += batchSize) {
          const batch = jobs.slice(index, index + batchSize);

          const batchRankings = await analyzeJobBatchForCandidate(
            state.profile,
            preferences,
            batch
          );

          rankings.push(...batchRankings);
          await saveJobAiRankings(batchRankings);
        }

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
