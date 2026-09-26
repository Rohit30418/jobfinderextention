const SETUP_PAGE = "onboarding/onboarding.html";
const PREFERENCES_PAGE = "preferences/preferences.html";
const NAUKRI_PAGE = "stage3/naukri.html";
const STATE_KEY = "jobpilot.stage1.state";
const PREFERENCES_KEY = "jobpilot.stage2.preferences";

function openPage(path) {
  chrome.tabs.create({ url: chrome.runtime.getURL(path) });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    openPage(SETUP_PAGE);
  }
});

chrome.action.onClicked.addListener(async () => {
  const result = await chrome.storage.local.get([STATE_KEY, PREFERENCES_KEY]);
  const hasProfile = Boolean(result[STATE_KEY] && result[STATE_KEY].profile);
  const preferences = result[PREFERENCES_KEY];
  const hasPreferences = Boolean(
    preferences &&
    preferences.updatedAt &&
    Array.isArray(preferences.targetRoles) &&
    preferences.targetRoles.length
  );

  if (!hasProfile) {
    openPage(SETUP_PAGE);
    return;
  }

  openPage(hasPreferences ? NAUKRI_PAGE : PREFERENCES_PAGE);
});
