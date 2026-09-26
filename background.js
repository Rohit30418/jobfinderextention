const SETUP_PAGE = "onboarding/onboarding.html";
const PREFERENCES_PAGE = "preferences/preferences.html";
const NAUKRI_PAGE = "stage3/naukri.html";
const EXTRACTOR_PAGE = "stage4/extractor.html";

const STATE_KEY = "jobpilot.stage1.state";
const PREFERENCES_KEY = "jobpilot.stage2.preferences";
const NAUKRI_SEARCH_KEY = "jobpilot.stage3.naukriSearch";
const PORTAL_CAPTURE_KEY = "jobpilot.stage4.portalCapture";
const INJECTION_STATUS_KEY = "jobpilot.naukri.injectionStatus";

const NAUKRI_HOST_RE = /^https:\/\/(?:[^/]+\.)?naukri\.com\//i;

function openPage(path) {
  chrome.tabs.create({ url: chrome.runtime.getURL(path) });
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
        "content/naukri-detector.css",
        "content/portal-runtime.css"
      ]
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "content/naukri-detector.js",
        "core/portal-engine.js",
        "portals/naukri/listing.js",
        "portals/naukri/detail.js",
        "portals/naukri/adapter.js",
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

  openPage(hasExtraction ? EXTRACTOR_PAGE : NAUKRI_PAGE);
});
