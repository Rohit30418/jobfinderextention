const SETUP_PAGE = "onboarding/onboarding.html";

function openSetup() {
  chrome.tabs.create({ url: chrome.runtime.getURL(SETUP_PAGE) });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    openSetup();
  }
});

chrome.action.onClicked.addListener(() => {
  openSetup();
});
