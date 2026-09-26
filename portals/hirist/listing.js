(() => {
  if (globalThis.JobPilotHiristListing) return;
  const u = globalThis.JobPilotPortalUtils;
  if (!u) return;

  globalThis.JobPilotHiristListing = u.createListing({
    method: "hirist-dom-card-v2",
    isListingPage(loc) {
      return /\/jobfeed/i.test(loc.pathname) || /\/search\//i.test(loc.pathname) || /^\/search$/i.test(loc.pathname);
    },
    isJobUrl(url) {
      return /^\/j\//i.test(new URL(url).pathname);
    },
    cardSelectors: [
      "[class*='job-card']",
      "[class*='jobCard']",
      "[class*='job-item']",
      "[class*='jobItem']",
      "[class*='job-list'] li",
      "article",
      "li"
    ],
    titleLinkSelectors: [
      "a[href^='/j/']",
      "a[href*='hirist.tech/j/']"
    ],
    companySelectors: [
      "[class*='company-name']",
      "[class*='companyName']",
      "[class*='company']",
      "[class*='organisation']",
      "[class*='organization']"
    ],
    experienceSelectors: [
      "[class*='experience']",
      "[class*='exp-']",
      "[class*='exp_']",
      "[class*='exp']"
    ],
    locationSelectors: [
      "[class*='location']",
      "[class*='loc-']",
      "[class*='loc_']",
      "[class*='loc']"
    ],
    salarySelectors: [
      "[class*='salary']",
      "[class*='ctc']"
    ],
    postedSelectors: [
      "[class*='posted']",
      "[class*='posting']",
      "[class*='date']",
      "time"
    ],
    skillsSelectors: [
      "[class*='skill']",
      "[class*='tag']"
    ],
    snippetSelectors: [
      "[class*='description']",
      "[class*='desc']",
      "[class*='summary']"
    ],
    cardSignalPattern: /years?|posted|apply|skills?|job|company/i
  });
})();