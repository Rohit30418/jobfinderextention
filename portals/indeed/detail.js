(() => {
  if (globalThis.JobPilotIndeedDetail) return;
  const u = globalThis.JobPilotPortalUtils;
  if (!u) return;

  globalThis.JobPilotIndeedDetail = u.createDetail({
    isDetailPage(loc) {
      return /\/viewjob/i.test(loc.pathname) || /\/rc\/clk/i.test(loc.pathname) || new URLSearchParams(loc.search).has("jk");
    },
    titleSelectors: [
      "h1[data-testid='jobsearch-JobInfoHeader-title']",
      ".jobsearch-JobInfoHeader-title",
      "h1"
    ],
    companySelectors: [
      "[data-testid='inlineHeader-companyName']",
      "[data-company-name]",
      ".jobsearch-InlineCompanyRating div:first-child",
      "[class*='companyName']"
    ],
    experienceSelectors: [
      "[data-testid*='experience']",
      "[class*='experience']",
      "#jobDetailsSection"
    ],
    locationSelectors: [
      "[data-testid='job-location']",
      "[data-testid='inlineHeader-companyLocation']",
      "[class*='companyLocation']"
    ],
    salarySelectors: [
      "#salaryInfoAndJobType",
      "[data-testid='jobsearch-JobInfoHeader-salary']",
      "[class*='salary']"
    ],
    descriptionSelectors: [
      "#jobDescriptionText",
      ".jobsearch-jobDescriptionText",
      "[class*='jobDescription']"
    ],
    skillsSelectors: [
      "[data-testid*='skills'] li",
      "[class*='skillsSection'] li",
      "[class*='skill']"
    ],
    postedSelectors: [
      "[data-testid='jobsearch-JobInfoFooter']",
      "[class*='date']",
      "time"
    ],
    employmentSelectors: [
      "#salaryInfoAndJobType",
      "[data-testid*='jobType']",
      "[class*='jobType']"
    ]
  });
})();