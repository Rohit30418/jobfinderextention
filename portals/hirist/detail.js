(() => {
  if (globalThis.JobPilotHiristDetail) return;
  const u = globalThis.JobPilotPortalUtils;
  if (!u) return;

  globalThis.JobPilotHiristDetail = u.createDetail({
    isDetailPage(loc) { return /^\/j\//i.test(loc.pathname); },
    titleSelectors: ["h1", "[class*='job-title']", "[class*='jobTitle']", "[class*='title']"],
    companySelectors: ["[class*='company-name']", "[class*='companyName']", "[class*='company']", "[class*='organisation']"],
    experienceSelectors: ["[class*='experience']", "[class*='exp']"],
    locationSelectors: ["[class*='location']", "[class*='loc']"],
    salarySelectors: ["[class*='salary']", "[class*='ctc']"],
    descriptionSelectors: [
      "[class*='job-description']",
      "[class*='jobDescription']",
      "[class*='job-desc']",
      "[class*='description']",
      "[class*='detail'] section"
    ],
    skillsSelectors: ["[class*='skills'] li", "[class*='skill']", "[class*='tag']"],
    postedSelectors: ["[class*='posted']", "[class*='posting']", "[class*='date']", "time"],
    employmentSelectors: ["[class*='employment']", "[class*='job-type']", "[class*='jobType']"]
  });
})();