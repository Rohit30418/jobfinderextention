(() => {
  if (globalThis.JobPilotLinkedInListing) return;
  const u = globalThis.JobPilotPortalUtils;
  if (!u) return;

  globalThis.JobPilotLinkedInListing = u.createListing({
    method: "linkedin-dom-card-v2",
    isListingPage(loc) {
      return /\/jobs\/search/i.test(loc.pathname) || /\/jobs\/collections/i.test(loc.pathname) || /^\/jobs\/?$/i.test(loc.pathname);
    },
    isJobUrl(url) {
      return /\/jobs\/view\//i.test(new URL(url).pathname);
    },
    cardSelectors: [
      ".jobs-search-results__list-item",
      ".job-card-container",
      ".base-card",
      "li[data-occludable-job-id]",
      "[data-occludable-job-id]",
      "[data-job-id]"
    ],
    titleLinkSelectors: [
      "a.job-card-list__title--link",
      "a.job-card-container__link",
      "a.base-card__full-link",
      "a[href*='/jobs/view/']"
    ],
    companySelectors: [
      ".job-card-container__primary-description",
      ".base-search-card__subtitle",
      "[class*='company-name']",
      "[class*='primary-description']"
    ],
    experienceSelectors: ["[class*='experience']", "[class*='job-criteria']"],
    locationSelectors: [
      ".job-card-container__metadata-item",
      ".job-search-card__location",
      "[class*='location']"
    ],
    salarySelectors: ["[class*='salary']", "[class*='compensation']"],
    postedSelectors: ["time", ".job-search-card__listdate", ".job-search-card__listdate--new", "[class*='listdate']"],
    skillsSelectors: ["[class*='skill']"],
    snippetSelectors: ["[class*='job-card-container__description']", "[class*='job-card-list__description']"],
    cardSignalPattern: /ago|applicant|promoted|actively hiring|job/i
  });
})();