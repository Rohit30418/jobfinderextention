(() => {
  if (globalThis.JobPilotFounditListing) return;
  const u = globalThis.JobPilotPortalUtils;
  if (!u) return;

  globalThis.JobPilotFounditListing = u.createListing({
    method: "foundit-dom-card-v2",
    isListingPage(loc) {
      return /\/search(?:\/|$)/i.test(loc.pathname) || /-jobs(?:\/|$)/i.test(loc.pathname);
    },
    isJobUrl(url) {
      const p = new URL(url).pathname;
      return /\/job\//i.test(p) || /\/job-detail\//i.test(p);
    },
    cardSelectors: [
      "[class*='job-card']",
      "[class*='jobCard']",
      "[class*='job-item']",
      "[class*='jobItem']",
      "[class*='card-container']",
      "article"
    ],
    titleLinkSelectors: [
      "a[href*='/job/']",
      "a[href*='/job-detail/']",
      "h2 a[href]",
      "h3 a[href]"
    ],
    companySelectors: ["[class*='company-name']", "[class*='companyName']", "[class*='company']"],
    experienceSelectors: ["[class*='experience']", "[class*='exp']"],
    locationSelectors: ["[class*='location']", "[class*='loc']"],
    salarySelectors: ["[class*='salary']", "[class*='ctc']"],
    postedSelectors: ["[class*='posted']", "[class*='post-date']", "[class*='date']", "time"],
    skillsSelectors: ["[class*='skill'] li", "[class*='skills'] span", "[class*='tag']"],
    snippetSelectors: ["[class*='description']", "[class*='desc']", "[class*='snippet']"],
    cardSignalPattern: /yrs?|years?|skills?|location|apply|posted/i
  });
})();