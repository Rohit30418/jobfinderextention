(() => {
  if (globalThis.JobPilotFounditDetail) return;
  const u = globalThis.JobPilotPortalUtils;
  if (!u) return;

  globalThis.JobPilotFounditDetail = u.createDetail({
    isDetailPage(loc) { return /\/job\//i.test(loc.pathname) || /\/job-detail\//i.test(loc.pathname); },
    titleSelectors: ["h1", "[class*='job-title']", "[class*='jobTitle']"],
    companySelectors: ["[class*='company-name']", "[class*='companyName']", "[class*='company']"],
    experienceSelectors: ["[class*='experience']", "[class*='exp']"],
    locationSelectors: ["[class*='location']", "[class*='loc']"],
    salarySelectors: ["[class*='salary']", "[class*='ctc']"],
    descriptionSelectors: ["[class*='job-description']", "[class*='jobDescription']", "[class*='jd-desc']", "[class*='description']"],
    skillsSelectors: ["[class*='skills'] li", "[class*='skill']", "[class*='tag']"],
    postedSelectors: ["[class*='posted']", "[class*='post-date']", "[class*='date']", "time"],
    employmentSelectors: ["[class*='employment']", "[class*='job-type']", "[class*='jobType']"]
  });
})();