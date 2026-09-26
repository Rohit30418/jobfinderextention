const SETUP_PAGE = "onboarding/onboarding.html";
const PREFERENCES_PAGE = "preferences/preferences.html";
const STATE_KEY = "jobpilot.stage1.state";

function openPage(path) {
  chrome.tabs.create({ url: chrome.runtime.getURL(path) });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    openPage(SETUP_PAGE);
  }
});

chrome.action.onClicked.addListener(async () => {
  const result = await chrome.storage.local.get(STATE_KEY);
  const hasProfile = Boolean(result[STATE_KEY] && result[STATE_KEY].profile);
  openPage(hasProfile ? PREFERENCES_PAGE : SETUP_PAGE);
});
