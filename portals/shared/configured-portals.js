(() => {
  const factory = globalThis.JobPilotConfiguredPortalFactory;
  if (!factory || globalThis.__JOBPILOT_CONFIGURED_PORTALS__) return;

  globalThis.__JOBPILOT_CONFIGURED_PORTALS__ = true;

  factory.register({
    id: "foundit",
    displayName: "Foundit",
    version: "1",
    hosts: ["foundit.in"],
    isJobUrl(url) {
      try {
        const parsed = new URL(url);
        return (
          /\/job\//i.test(parsed.pathname) ||
          /\/job-detail\//i.test(parsed.pathname)
        );
      } catch (_) {
        return false;
      }
    },
    isDetailPage(location) {
      return (
        /\/job\//i.test(location.pathname) ||
        /\/job-detail\//i.test(location.pathname)
      );
    },
    isListingPage(location) {
      return (
        /\/search\//i.test(location.pathname) ||
        /\/search$/i.test(location.pathname) ||
        /-jobs(?:\/|$)/i.test(location.pathname)
      );
    },
    cardSelectors: [
      "[class*='job-card']",
      "[class*='jobCard']",
      "[class*='job-item']",
      "[class*='jobItem']",
      "article"
    ],
    titleLinkSelectors: [
      "a[href*='/job/']",
      "a[href*='/job-detail/']",
      "h2 a[href]",
      "h3 a[href]"
    ],
    companySelectors: [
      "[class*='company-name']",
      "[class*='companyName']",
      "[class*='company']"
    ],
    experienceSelectors: [
      "[class*='experience']",
      "[class*='exp']"
    ],
    locationSelectors: [
      "[class*='location']",
      "[class*='loc']"
    ],
    salarySelectors: [
      "[class*='salary']",
      "[class*='ctc']"
    ],
    postedSelectors: [
      "[class*='posted']",
      "[class*='post-date']",
      "[class*='date']",
      "time"
    ],
    skillsSelectors: [
      "[class*='skill'] li",
      "[class*='skills'] span",
      "[class*='tag']"
    ],
    snippetSelectors: [
      "[class*='description']",
      "[class*='desc']",
      "[class*='snippet']"
    ],
    detailTitleSelectors: [
      "h1",
      "[class*='job-title']",
      "[class*='jobTitle']"
    ],
    detailCompanySelectors: [
      "[class*='company-name']",
      "[class*='companyName']",
      "[class*='company']"
    ],
    detailExperienceSelectors: [
      "[class*='experience']",
      "[class*='exp']"
    ],
    detailLocationSelectors: [
      "[class*='location']",
      "[class*='loc']"
    ],
    detailSalarySelectors: [
      "[class*='salary']",
      "[class*='ctc']"
    ],
    detailDescriptionSelectors: [
      "[class*='job-description']",
      "[class*='jobDescription']",
      "[class*='description']",
      "[class*='jd-desc']"
    ],
    detailSkillsSelectors: [
      "[class*='skill'] li",
      "[class*='skills'] span",
      "[class*='tag']"
    ],
    detailPostedSelectors: [
      "[class*='posted']",
      "[class*='post-date']",
      "[class*='date']",
      "time"
    ],
    detailEmploymentSelectors: [
      "[class*='employment']",
      "[class*='job-type']"
    ],
    cardSignalPattern: /yrs?|years?|skills?|location|apply/i
  });

  factory.register({
    id: "linkedin",
    displayName: "LinkedIn",
    version: "1",
    hosts: ["linkedin.com"],
    isJobUrl(url) {
      try {
        const parsed = new URL(url);
        return /\/jobs\/view\//i.test(parsed.pathname);
      } catch (_) {
        return false;
      }
    },
    isDetailPage(location) {
      return /\/jobs\/view\//i.test(location.pathname);
    },
    isListingPage(location) {
      return (
        /\/jobs\/search/i.test(location.pathname) ||
        /\/jobs\/collections/i.test(location.pathname) ||
        /^\/jobs\/?$/i.test(location.pathname)
      );
    },
    cardSelectors: [
      ".jobs-search-results__list-item",
      ".job-card-container",
      ".base-card",
      "[data-occludable-job-id]",
      "li[data-occludable-job-id]"
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
    experienceSelectors: [
      "[class*='experience']"
    ],
    locationSelectors: [
      ".job-card-container__metadata-item",
      ".job-search-card__location",
      "[class*='location']"
    ],
    salarySelectors: [
      "[class*='salary']"
    ],
    postedSelectors: [
      "time",
      ".job-search-card__listdate",
      ".job-search-card__listdate--new",
      "[class*='listdate']"
    ],
    skillsSelectors: [
      "[class*='skill']"
    ],
    snippetSelectors: [
      "[class*='job-card-container__description']",
      "[class*='job-card-list__description']"
    ],
    detailTitleSelectors: [
      "h1",
      ".job-details-jobs-unified-top-card__job-title",
      ".top-card-layout__title"
    ],
    detailCompanySelectors: [
      ".job-details-jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
      ".top-card-layout__card a[href*='/company/']"
    ],
    detailExperienceSelectors: [
      "[class*='experience-level']",
      "[class*='job-criteria-text']"
    ],
    detailLocationSelectors: [
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".topcard__flavor--bullet",
      ".top-card-layout__first-subline"
    ],
    detailSalarySelectors: [
      "[class*='salary']",
      "[class*='compensation']"
    ],
    detailDescriptionSelectors: [
      ".jobs-description__content",
      ".jobs-box__html-content",
      ".show-more-less-html__markup",
      ".description__text"
    ],
    detailSkillsSelectors: [
      "[class*='job-details-skill-match-status-list'] li",
      "[class*='skill']"
    ],
    detailPostedSelectors: [
      "time",
      ".posted-time-ago__text",
      "[class*='posted']"
    ],
    detailEmploymentSelectors: [
      "[class*='employment-type']",
      "[class*='job-criteria-text']"
    ],
    cardSignalPattern: /ago|applicant|promoted|actively hiring|job/i
  });

  factory.register({
    id: "indeed",
    displayName: "Indeed",
    version: "1",
    hosts: ["indeed.com"],
    isJobUrl(url) {
      try {
        const parsed = new URL(url);
        return (
          /\/viewjob/i.test(parsed.pathname) ||
          /\/rc\/clk/i.test(parsed.pathname) ||
          parsed.searchParams.has("jk")
        );
      } catch (_) {
        return false;
      }
    },
    isDetailPage(location) {
      return (
        /\/viewjob/i.test(location.pathname) ||
        /\/rc\/clk/i.test(location.pathname)
      );
    },
    isListingPage(location) {
      return (
        /\/jobs/i.test(location.pathname) ||
        /-jobs(?:\.html)?$/i.test(location.pathname) ||
        /^\/q-/i.test(location.pathname)
      );
    },
    cardSelectors: [
      ".job_seen_beacon",
      ".resultContent",
      "[data-jk]",
      ".cardOutline",
      "li.css-5lfssm"
    ],
    titleLinkSelectors: [
      "a.jcs-JobTitle",
      "a[data-jk]",
      "h2 a[href*='jk=']",
      "a[href*='/viewjob']"
    ],
    companySelectors: [
      "[data-testid='company-name']",
      ".companyName",
      "[class*='companyName']"
    ],
    experienceSelectors: [
      "[class*='experience']"
    ],
    locationSelectors: [
      "[data-testid='text-location']",
      ".company_location",
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
      "[class*='date']"
    ],
    skillsSelectors: [
      "[class*='skill']"
    ],
    snippetSelectors: [
      ".job-snippet",
      "[class*='job-snippet']"
    ],
    detailTitleSelectors: [
      "h1[data-testid='jobsearch-JobInfoHeader-title']",
      "h1",
      ".jobsearch-JobInfoHeader-title"
    ],
    detailCompanySelectors: [
      "[data-testid='inlineHeader-companyName']",
      "[data-company-name]",
      ".jobsearch-InlineCompanyRating div:first-child",
      "[class*='companyName']"
    ],
    detailExperienceSelectors: [
      "[class*='experience']",
      "[data-testid*='experience']"
    ],
    detailLocationSelectors: [
      "[data-testid='job-location']",
      "[data-testid='inlineHeader-companyLocation']",
      "[class*='companyLocation']"
    ],
    detailSalarySelectors: [
      "#salaryInfoAndJobType",
      "[data-testid='jobsearch-JobInfoHeader-salary']",
      "[class*='salary']"
    ],
    detailDescriptionSelectors: [
      "#jobDescriptionText",
      ".jobsearch-jobDescriptionText",
      "[class*='jobDescription']"
    ],
    detailSkillsSelectors: [
      "[class*='skillsSection'] li",
      "[class*='skill']"
    ],
    detailPostedSelectors: [
      "[data-testid='jobsearch-JobInfoFooter']",
      "[class*='date']"
    ],
    detailEmploymentSelectors: [
      "#salaryInfoAndJobType",
      "[class*='jobType']",
      "[data-testid*='jobType']"
    ],
    cardSignalPattern: /ago|easily apply|responsive employer|salary|job/i
  });

  factory.register({
    id: "hirist",
    displayName: "Hirist",
    version: "1",
    hosts: ["hirist.tech"],
    isJobUrl(url) {
      try {
        const parsed = new URL(url);
        return /^\/j\//i.test(parsed.pathname);
      } catch (_) {
        return false;
      }
    },
    isDetailPage(location) {
      return /^\/j\//i.test(location.pathname);
    },
    isListingPage(location) {
      return !/^\/j\//i.test(location.pathname);
    },
    cardSelectors: [
      "[class*='job-card']",
      "[class*='jobCard']",
      "[class*='job-item']",
      "[class*='jobItem']",
      "article",
      "li"
    ],
    titleLinkSelectors: [
      "a[href^='/j/']",
      "a[href*='hirist.tech/j/']"
    ],
    companySelectors: [
      "[class*='company']",
      "[class*='organisation']",
      "[class*='organization']"
    ],
    experienceSelectors: [
      "[class*='experience']",
      "[class*='exp']"
    ],
    locationSelectors: [
      "[class*='location']",
      "[class*='loc']"
    ],
    salarySelectors: [
      "[class*='salary']",
      "[class*='ctc']"
    ],
    postedSelectors: [
      "[class*='posted']",
      "[class*='date']",
      "time"
    ],
    skillsSelectors: [
      "[class*='skill']",
      "[class*='tag']"
    ],
    snippetSelectors: [
      "[class*='description']",
      "[class*='desc']"
    ],
    detailTitleSelectors: [
      "h1",
      "[class*='job-title']",
      "[class*='jobTitle']"
    ],
    detailCompanySelectors: [
      "[class*='company']",
      "[class*='organisation']",
      "[class*='organization']"
    ],
    detailExperienceSelectors: [
      "[class*='experience']",
      "[class*='exp']"
    ],
    detailLocationSelectors: [
      "[class*='location']",
      "[class*='loc']"
    ],
    detailSalarySelectors: [
      "[class*='salary']",
      "[class*='ctc']"
    ],
    detailDescriptionSelectors: [
      "[class*='job-description']",
      "[class*='jobDescription']",
      "[class*='description']",
      "section"
    ],
    detailSkillsSelectors: [
      "[class*='skill']",
      "[class*='tag']"
    ],
    detailPostedSelectors: [
      "[class*='posted']",
      "[class*='date']",
      "time"
    ],
    detailEmploymentSelectors: [
      "[class*='employment']",
      "[class*='job-type']"
    ],
    cardSignalPattern: /years?|posted|apply|skills?|job/i
  });
})();