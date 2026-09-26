import {
  getAiAuthorized,
  getJobCache,
  getPuterToken,
  getPreferences,
  getState,
  saveJobAiAnalysis,
  saveJobDeepMatch
} from "./core/storage.js";
import { analyzeJobWithAi } from "./core/puter-client.js";
import { evaluateDeepMatch } from "./core/match-engine.js";

const SETUP_PAGE = "onboarding/onboarding.html";
const PREFERENCES_PAGE = "preferences/preferences.html";
const NAUKRI_PAGE = "stage3/naukri.html";
const EXTRACTOR_PAGE = "stage4/extractor.html";
const MATCH_PAGE = "stage5/match.html";

const STATE_KEY = "jobpilot.stage1.state";
const PREFERENCES_KEY = "jobpilot.stage2.preferences";
const NAUKRI_SEARCH_KEY = "jobpilot.stage3.naukriSearch";
const PORTAL_CAPTURE_KEY = "jobpilot.stage4.portalCapture";
const INJECTION_STATUS_KEY = "jobpilot.naukri.injectionStatus";

const NAUKRI_HOST_RE = /^https:\/\/(?:[^/]+\.)?naukri\.com\//i;

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
    aiStatus = job.aiAnalysis && !forceAi ? "cached" : "analyzing";

    if (!job.aiAnalysis || forceAi) {
      const analysis = await analyzeJobWithAi(job);
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

async function injectJobPilotIntoNaukri(tabId, url, reason = "background") {
  if (!tabId || !NAUKRI_HOST_RE.test(String(url || ""))) {
    return false;
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: [
        "content/portal-runtime.css"
      ]
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "core/portal-engine.js",
        "portals/naukri/listing.js",
        "portals/naukri/detail.js",
        "portals/naukri/adapter.js",
        "core/relevance-gate.js",
        "content/portal-runtime.js"
      ]
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

    console.warn("JobPilot Naukri injection failed", error);
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  if (message?.type === "jobpilot:open-full-match") {
    openPage(MATCH_PAGE);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "jobpilot:open-stage4") {
    openPage(EXTRACTOR_PAGE);
    sendResponse({ ok: true });
    return false;
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
    injectJobPilotIntoNaukri(tabId, tab.url, "tab-complete");
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        "https://naukri.com/*",
        "https://www.naukri.com/*",
        "https://*.naukri.com/*"
      ]
    });

    for (const tab of tabs) {
      if (tab.id && tab.url) {
        await injectJobPilotIntoNaukri(tab.id, tab.url, "browser-startup");
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
  // If the user clicks JobPilot while on Naukri, force-inject there first.
  if (tab?.id && NAUKRI_HOST_RE.test(String(tab.url || ""))) {
    await injectJobPilotIntoNaukri(
      tab.id,
      tab.url,
      "toolbar-activeTab"
    );
  }

  const result = await chrome.storage.local.get([
    STATE_KEY,
    PREFERENCES_KEY,
    NAUKRI_SEARCH_KEY,
    PORTAL_CAPTURE_KEY
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

  const capture = result[PORTAL_CAPTURE_KEY];
  const hasExtraction = Boolean(
    capture &&
    capture.capturedAt &&
    (
      capture.pageType === "listing" ||
      capture.pageType === "detail"
    )
  );

  if (!hasProfile) {
    openPage(SETUP_PAGE);
    return;
  }

  if (!hasPreferences) {
    openPage(PREFERENCES_PAGE);
    return;
  }

  if (!hasSearch) {
    openPage(NAUKRI_PAGE);
    return;
  }

  const hasDeepMatch = Boolean(
    capture &&
    capture.pageType === "detail" &&
    capture.detail &&
    capture.detail.deepMatch
  );

  openPage(
    hasDeepMatch
      ? MATCH_PAGE
      : hasExtraction
        ? EXTRACTOR_PAGE
        : NAUKRI_PAGE
  );
});
