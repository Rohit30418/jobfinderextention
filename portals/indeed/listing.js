(() => {
  if (globalThis.JobPilotIndeedListing) return;
  const u = globalThis.JobPilotPortalUtils;
  if (!u) return;

  globalThis.JobPilotIndeedListing = u.createListing({
    method: "indeed-dom-card-v2",
    isListingPage(loc) {
      return /\/jobs/i.test(loc.pathname) || /^\/q-/i.test(loc.pathname);
    },
    isJobUrl(url) {
      const x = new URL(url);
      return /\/viewjob/i.test(x.pathname) || /\/rc\/clk/i.test(x.pathname) || x.searchParams.has("jk");
    },
    cardSelectors: [
      ".job_seen_beacon",
      "div.job_seen_beacon",
      ".cardOutline",
      ".resultContent",
      "[data-jk]",
      "li[data-jk]",
      "div[data-testid='slider_item']"
    ],
    titleLinkSelectors: [
      "a.jcs-JobTitle",
      "h2.jobTitle a",
      "a[data-jk]",
      "a[href*='/viewjob']",
      "a[href*='jk=']"
    ],
    companySelectors: [
      "[data-testid='company-name']",
      ".companyName",
      "span[data-testid='company-name']",
      "[class*='companyName']"
    ],
    experienceSelectors: [
      "[data-testid*='experience']",
      "[class*='experience']",
      "[class*='metadata']"
    ],
    locationSelectors: [
      "[data-testid='text-location']",
      ".company_location",
      ".companyLocation",
      "[class*='companyLocation']"
    ],
    salarySelectors: [
      ".salary-snippet-container",
      "[data-testid='attribute_snippet_testid']",
      "[class*='salary']"
    ],
    postedSelectors: [
      ".date",
      "[data-testid='myJobsStateDate']",
      "[class*='date']",
      "span[data-testid*='date']"
    ],
    skillsSelectors: [
      "[class*='skill']",
      "[data-testid*='skill']"
    ],
    snippetSelectors: [
      ".job-snippet",
      "[class*='job-snippet']",
      "[class*='snippet']"
    ],
    cardSignalPattern: /ago|easily apply|responsive employer|salary|job/i
  });
})();