(() => {
  if (globalThis.JobPilotLinkedInDetail) return;
  const u = globalThis.JobPilotPortalUtils;
  if (!u) return;

  globalThis.JobPilotLinkedInDetail = u.createDetail({
    isDetailPage(loc) { return /\/jobs\/view\//i.test(loc.pathname); },
    titleSelectors: ["h1", ".job-details-jobs-unified-top-card__job-title", ".top-card-layout__title"],
    companySelectors: [
      ".job-details-jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
      ".top-card-layout__card a[href*='/company/']"
    ],
    experienceSelectors: ["[class*='experience-level']", "[class*='job-criteria-text']", ".job-details-jobs-unified-top-card__job-insight"],
    locationSelectors: [
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".topcard__flavor--bullet",
      ".top-card-layout__first-subline"
    ],
    salarySelectors: ["[class*='salary']", "[class*='compensation']"],
    descriptionSelectors: [
      ".jobs-description__content",
      ".jobs-box__html-content",
      ".show-more-less-html__markup",
      ".description__text"
    ],
    skillsSelectors: ["[class*='job-details-skill-match-status-list'] li", "[class*='skill']"],
    postedSelectors: ["time", ".posted-time-ago__text", "[class*='posted']"],
    employmentSelectors: ["[class*='employment-type']", "[class*='job-criteria-text']"]
  });
})();