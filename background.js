const SETUP_PAGE = "onboarding/onboarding.html";
const PREFERENCES_PAGE = "preferences/preferences.html";
const NAUKRI_PAGE = "stage3/naukri.html";
const EXTRACTOR_PAGE = "stage4/extractor.html";

const STATE_KEY = "jobpilot.stage1.state";
const PREFERENCES_KEY = "jobpilot.stage2.preferences";
const NAUKRI_SEARCH_KEY = "jobpilot.stage3.naukriSearch";
const NAUKRI_EXTRACTION_KEY = "jobpilot.stage4.naukriExtraction";

function openPage(path) {
  chrome.tabs.create({ url: chrome.runtime.getURL(path) });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    openPage(SETUP_PAGE);
  }
});

chrome.action.onClicked.addListener(async () => {
  const result = await chrome.storage.local.get([
    STATE_KEY,
    PREFERENCES_KEY,
    NAUKRI_SEARCH_KEY,
    NAUKRI_EXTRACTION_KEY
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

  const extraction = result[NAUKRI_EXTRACTION_KEY];
  const hasExtraction = Boolean(
    extraction &&
    extraction.extractedAt &&
    (
      extraction.pageType === "search-results" ||
      extraction.pageType === "job-detail"
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

const NAUKRI_HOST_RE = /^https:\/\/(?:www\.)?naukri\.com\//i;

async function injectJobPilotIntoNaukri(tabId, url) {
  if (!tabId || !NAUKRI_HOST_RE.test(String(url || ""))) return;

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: [
        "content/naukri-detector.css",
        "content/naukri-extractor.css"
      ]
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "content/naukri-detector.js",
        "content/naukri-extractor.js"
      ]
    });
  } catch (error) {
    console.warn("JobPilot Naukri injection fallback failed", error);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    injectJobPilotIntoNaukri(tabId, tab.url);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        "https://naukri.com/*",
        "https://www.naukri.com/*"
      ]
    });

    for (const tab of tabs) {
      if (tab.id && tab.url) {
        await injectJobPilotIntoNaukri(tab.id, tab.url);
      }
    }
  } catch (error) {
    console.warn("JobPilot startup Naukri reinjection failed", error);
  }
});
