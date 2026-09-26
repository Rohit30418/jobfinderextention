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
