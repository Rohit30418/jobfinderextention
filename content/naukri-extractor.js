(() => {
  const EXTRACTION_KEY = "jobpilot.stage4.naukriExtraction";
  const ROOT_ID = "jobpilot-naukri-stage4";
  const MAX_CARDS = 75;
  const MAX_DETAIL_DESCRIPTION = 25000;

  let lastSignature = "";
  let lastUrl = location.href;
  let closedForUrl = "";

  function clean(value, max = 5000) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\t\r]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .replace(/ {2,}/g, " ")
      .trim()
      .slice(0, max);
  }

  function norm(value) {
    return clean(value, 10000).toLowerCase().replace(/\s+/g, " ");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function unique(values) {
    return [...new Set(values.map((item) => clean(item, 200)).filter(Boolean))];
  }

  function absoluteUrl(value) {
    try {
      return new URL(value, location.href).href;
    } catch (_) {
      return "";
    }
  }

  function textOf(element, max = 500) {
    return element ? clean(element.textContent || element.innerText || "", max) : "";
  }

  function firstText(root, selectors, max = 500) {
    for (const selector of selectors) {
      let element = null;
      try {
        element = root.querySelector(selector);
      } catch (_) {}

      const text = textOf(element, max);
      if (text) return text;
    }
    return "";
  }

  function allTexts(root, selectors, limit = 24) {
    const output = [];

    for (const selector of selectors) {
      let nodes = [];
      try {
        nodes = Array.from(root.querySelectorAll(selector));
      } catch (_) {}

      for (const node of nodes) {
        const text = textOf(node, 120);
        if (
          text &&
          text.length <= 90 &&
          !/^apply$/i.test(text) &&
          !output.includes(text)
        ) {
          output.push(text);
          if (output.length >= limit) return output;
        }
      }
    }

    return output;
  }

  function scopedRegex(text, patterns) {
    const source = clean(text, 6000);
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match && match[0]) return clean(match[0], 250);
    }
    return "";
  }

  function stripHtml(html, max = MAX_DETAIL_DESCRIPTION) {
    if (!html) return "";
    try {
      const doc = new DOMParser().parseFromString(String(html), "text/html");
      return clean(doc.body?.innerText || doc.body?.textContent || "", max);
    } catch (_) {
      return clean(String(html).replace(/<[^>]+>/g, " "), max);
    }
  }

  function jobIdFromUrl(url) {
    const value = String(url || "");
    const matches = value.match(/(?:^|[-/])(\d{7,})(?:[/?#]|$)/g);
    if (!matches || !matches.length) return "";

    const digits = matches[matches.length - 1].match(/\d{7,}/);
    return digits ? digits[0] : "";
  }

  function jobAnchors() {
    const anchors = Array.from(
      document.querySelectorAll(
        'a[href*="/job-listings-"], a[href*="job-listings-"]'
      )
    );

    const seen = new Set();
    const output = [];

    for (const anchor of anchors) {
      const url = absoluteUrl(anchor.getAttribute("href") || anchor.href);
      if (
        !url ||
        !/naukri\.com/i.test(url) ||
        !/job-listings-/i.test(url)
      ) {
        continue;
      }

      const canonical = url.split("#")[0];
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      output.push(anchor);
      if (output.length >= MAX_CARDS) break;
    }

    return output;
  }

  function candidateScore(node) {
    if (!(node instanceof Element)) return -999;

    const text = textOf(node, 7000);
    if (text.length < 25 || text.length > 7000) return -20;

    const className = String(node.className || "");
    let score = 0;

    if (/srp-jobtuple|jobtuple|job-tuple|jobcard|job-card|tuple-wrapper/i.test(className)) {
      score += 8;
    }

    if (node.matches("article, li")) score += 2;

    const links = node.querySelectorAll(
      'a[href*="/job-listings-"], a[href*="job-listings-"]'
    ).length;
    if (links === 1) score += 7;
    else if (links > 3) score -= 6;

    if (node.querySelector(".comp-name, [class*='comp-name'], [class*='company']")) score += 3;
    if (node.querySelector(".expwdth, [class*='expwdth'], [class*='experience']")) score += 3;
    if (node.querySelector(".locWdth, [class*='locWdth'], [class*='location']")) score += 3;
    if (node.querySelector(".job-desc, [class*='job-desc'], [class*='description']")) score += 2;

    return score;
  }

  function findCardRoot(anchor) {
    const directSelectors = [
      ".srp-jobtuple-wrapper",
      ".jobTuple",
      "[class*='jobTuple']",
      "[class*='job-tuple']",
      "[class*='jobCard']",
      "[class*='job-card']",
      "article"
    ];

    for (const selector of directSelectors) {
      try {
        const direct = anchor.closest(selector);
        if (direct && textOf(direct, 7000).length >= 25) return direct;
      } catch (_) {}
    }

    let node = anchor;
    let best = anchor.parentElement;
    let bestScore = candidateScore(best);

    for (let depth = 0; depth < 8 && node?.parentElement; depth += 1) {
      node = node.parentElement;
      const score = candidateScore(node);
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }

    return best || anchor.parentElement || anchor;
  }

  function extractCompany(card, title) {
    const selectors = [
      ".comp-name",
      ".companyInfo .subTitle",
      "[class*='comp-name']",
      "[class*='company-name']",
      "[class*='companyName']",
      "a[title][class*='comp']"
    ];

    const value = firstText(card, selectors, 250);
    return value && norm(value) !== norm(title) ? value : "";
  }

  function extractExperience(card, cardText) {
    const direct = firstText(
      card,
      [
        ".expwdth",
        "[class*='expwdth']",
        "[class*='experience']",
        "[title*='experience' i]"
      ],
      160
    );
    if (direct) return { value: direct, source: "dom" };

    const fallback = scopedRegex(cardText, [
      /\b\d+\s*(?:-|–|to)\s*\d+\s*(?:yrs?|years?)\b/i,
      /\b\d+\+?\s*(?:yrs?|years?)\b/i
    ]);

    return { value: fallback, source: fallback ? "card-regex" : "" };
  }

  function extractLocation(card) {
    return firstText(
      card,
      [
        ".locWdth",
        "[class*='locWdth']",
        "[class*='location']",
        "[title*='location' i]"
      ],
      300
    );
  }

  function extractSalary(card, cardText) {
    const direct = firstText(
      card,
      [
        ".sal",
        "[class*='salary']",
        "[class*='sal-wrap']",
        "[title*='salary' i]"
      ],
      180
    );
    if (direct) return { value: direct, source: "dom" };

    const fallback = scopedRegex(cardText, [
      /₹\s*[\d,.]+\s*(?:-|–|to)\s*₹?\s*[\d,.]+\s*(?:LPA|PA|per annum)?/i,
      /\b\d+(?:\.\d+)?\s*(?:-|–|to)\s*\d+(?:\.\d+)?\s*(?:LPA|lakhs?|lacs?)\b/i,
      /\bnot disclosed\b/i
    ]);

    return { value: fallback, source: fallback ? "card-regex" : "" };
  }

  function extractPostedAge(card, cardText) {
    const direct = firstText(
      card,
      [
        ".job-post-day",
        "[class*='job-post-day']",
        "[class*='posted']",
        "[class*='post-day']"
      ],
      120
    );
    if (direct) return { value: direct, source: "dom" };

    const fallback = scopedRegex(cardText, [
      /\b(?:today|just now|few hours ago)\b/i,
      /\b\d+\s*(?:hour|hours|hr|hrs)\s*ago\b/i,
      /\b\d+\s*(?:day|days)\s*ago\b/i,
      /\b\d+\s*(?:week|weeks)\s*ago\b/i,
      /\b30\+?\s*days\s*ago\b/i
    ]);

    return { value: fallback, source: fallback ? "card-regex" : "" };
  }

  function extractSkills(card) {
    return unique(
      allTexts(
        card,
        [
          ".tags-gt .tag-li",
          ".tags-gt li",
          "[class*='tag-li']",
          "[class*='skill'] li",
          "[class*='skills'] li",
          "[class*='tags'] li"
        ],
        24
      )
    ).slice(0, 20);
  }

  function extractSnippet(card, title, company) {
    const direct = firstText(
      card,
      [
        ".job-desc",
        "[class*='job-desc']",
        "[class*='job-description']",
        "[class*='description']"
      ],
      700
    );

    if (direct) return direct;

    const text = textOf(card, 1400);
    let value = text;
    for (const remove of [title, company]) {
      if (remove) value = value.replace(remove, " ");
    }

    return clean(value, 650);
  }

  function confidenceForCard(job) {
    const weights = {
      title: 18,
      company: 14,
      jobUrl: 14,
      experience: 12,
      location: 10,
      postedAge: 8,
      skills: 10,
      descriptionSnippet: 8,
      salary: 6
    };

    let score = 0;
    const missing = [];

    for (const [field, weight] of Object.entries(weights)) {
      const value = job[field];
      const present = Array.isArray(value) ? value.length > 0 : Boolean(value);
      if (present) score += weight;
      else missing.push(field);
    }

    return {
      score,
      level: score >= 75 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW",
      missing
    };
  }

  function extractCard(anchor, index) {
    const card = findCardRoot(anchor);
    const jobUrl = absoluteUrl(anchor.getAttribute("href") || anchor.href);
    const title =
      clean(anchor.getAttribute("title"), 250) ||
      textOf(anchor, 250) ||
      firstText(card, ["a.title", "[class*='title'] a", "h2 a", "h3 a"], 250);

    if (!title || !jobUrl) return null;

    const cardText = textOf(card, 6000);
    const company = extractCompany(card, title);
    const experience = extractExperience(card, cardText);
    const salary = extractSalary(card, cardText);
    const posted = extractPostedAge(card, cardText);
    const locationValue = extractLocation(card);
    const skills = extractSkills(card);
    const descriptionSnippet = extractSnippet(card, title, company);

    const sources = {
      title: anchor.textContent?.trim() ? "job-link" : "card-dom",
      company: company ? "dom" : "",
      jobUrl: "job-link",
      experience: experience.source,
      location: locationValue ? "dom" : "",
      salary: salary.source,
      postedAge: posted.source,
      skills: skills.length ? "dom" : "",
      descriptionSnippet: descriptionSnippet ? "dom/scoped-card" : ""
    };

    const job = {
      index,
      jobId: jobIdFromUrl(jobUrl),
      title,
      company,
      experience: experience.value,
      location: locationValue,
      salary: salary.value,
      skills,
      descriptionSnippet,
      postedAge: posted.value,
      jobUrl,
      sources
    };

    job.extraction = confidenceForCard(job);
    return job;
  }

  function getJsonLdJobPosting() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent || "null");
        const queue = Array.isArray(parsed) ? [...parsed] : [parsed];

        while (queue.length) {
          const item = queue.shift();
          if (!item || typeof item !== "object") continue;

          const type = item["@type"];
          if (
            type === "JobPosting" ||
            (Array.isArray(type) && type.includes("JobPosting"))
          ) {
            return item;
          }

          if (Array.isArray(item["@graph"])) {
            queue.push(...item["@graph"]);
          }
        }
      } catch (_) {}
    }

    return null;
  }

  function jsonAddress(locationValue) {
    const items = Array.isArray(locationValue)
      ? locationValue
      : locationValue
        ? [locationValue]
        : [];

    const output = [];

    for (const item of items) {
      const address = item?.address || item;
      if (!address || typeof address !== "object") continue;

      const line = unique([
        address.addressLocality,
        address.addressRegion,
        address.addressCountry?.name || address.addressCountry
      ]).join(", ");

      if (line) output.push(line);
    }

    return unique(output).join(" | ");
  }

  function jsonSalary(baseSalary) {
    if (!baseSalary) return "";

    if (typeof baseSalary === "string") return clean(baseSalary, 250);

    const currency = clean(baseSalary.currency || "", 20);
    const value = baseSalary.value;

    if (value && typeof value === "object") {
      const min = value.minValue ?? "";
      const max = value.maxValue ?? "";
      const unit = value.unitText || "";
      const numbers =
        min !== "" && max !== ""
          ? min + " - " + max
          : String(min || max || "");

      return clean([currency, numbers, unit].filter(Boolean).join(" "), 250);
    }

    if (value !== undefined && value !== null) {
      return clean([currency, value].filter(Boolean).join(" "), 250);
    }

    return "";
  }

  function jsonSkills(value) {
    if (Array.isArray(value)) {
      return unique(value.flatMap((item) => String(item).split(/[,;|]/))).slice(0, 30);
    }

    return unique(String(value || "").split(/[,;|]/)).slice(0, 30);
  }

  function detailDomFallback() {
    const title = firstText(
      document,
      [
        ".jd-header-title",
        "[class*='jd-header-title']",
        "h1"
      ],
      300
    );

    const company = firstText(
      document,
      [
        ".jd-header-comp-name",
        ".jd-header-comp-name a",
        "[class*='comp-name']",
        "[class*='company-name']"
      ],
      300
    );

    const experience = firstText(
      document,
      [
        ".exp",
        "[class*='experience']",
        "[class*='exp-wrap']",
        "[class*='expwdth']"
      ],
      220
    );

    const jobLocation = firstText(
      document,
      [
        ".loc",
        "[class*='location']",
        "[class*='loc-wrap']",
        "[class*='locWdth']"
      ],
      350
    );

    const salary = firstText(
      document,
      [
        ".salary",
        "[class*='salary']",
        "[class*='sal-wrap']"
      ],
      220
    );

    const description = firstText(
      document,
      [
        ".dang-inner-html",
        ".job-desc",
        ".jobDescription",
        "[class*='job-desc']",
        "[class*='jobDescription']"
      ],
      MAX_DETAIL_DESCRIPTION
    );

    const skills = unique(
      allTexts(
        document,
        [
          ".key-skill .chip",
          ".key-skill a",
          "[class*='key-skill'] a",
          "[class*='key-skill'] li",
          "[class*='skills'] li",
          "[class*='skill'] a"
        ],
        35
      )
    ).slice(0, 30);

    const postedAge = firstText(
      document,
      [
        ".jd-stats",
        "[class*='jd-stats']",
        "[class*='posted']",
        "[class*='post-day']"
      ],
      300
    );

    return {
      title,
      company,
      experience,
      location: jobLocation,
      salary,
      description,
      skills,
      postedAge
    };
  }

  function valueOr(primary, fallback) {
    const present = Array.isArray(primary)
      ? primary.length > 0
      : Boolean(clean(primary, 50000));

    return present ? primary : fallback;
  }

  function detailConfidence(job) {
    const weights = {
      title: 14,
      company: 12,
      jobUrl: 10,
      description: 18,
      experience: 10,
      location: 8,
      salary: 6,
      skills: 10,
      datePosted: 6,
      employmentType: 3,
      education: 3
    };

    let score = 0;
    const missing = [];

    for (const [field, weight] of Object.entries(weights)) {
      const value = job[field];
      const present = Array.isArray(value) ? value.length > 0 : Boolean(value);
      if (present) score += weight;
      else missing.push(field);
    }

    return {
      score,
      level: score >= 78 ? "HIGH" : score >= 52 ? "MEDIUM" : "LOW",
      missing
    };
  }

  function extractDetail() {
    const json = getJsonLdJobPosting();
    const dom = detailDomFallback();

    const jsonTitle = clean(json?.title, 300);
    const jsonCompany = clean(json?.hiringOrganization?.name, 300);
    const jsonExperience = clean(
      typeof json?.experienceRequirements === "string"
        ? json.experienceRequirements
        : json?.experienceRequirements?.monthsOfExperience
          ? json.experienceRequirements.monthsOfExperience + " months"
          : "",
      250
    );
    const jsonLocation = jsonAddress(json?.jobLocation);
    const jsonDescription = stripHtml(json?.description);
    const jsonSkillList = jsonSkills(json?.skills || json?.qualifications || "");
    const jsonPosted = clean(json?.datePosted, 120);
    const jsonEmployment = Array.isArray(json?.employmentType)
      ? json.employmentType.join(", ")
      : clean(json?.employmentType, 180);
    const jsonEducation = clean(
      typeof json?.educationRequirements === "string"
        ? json.educationRequirements
        : json?.educationRequirements?.credentialCategory ||
          json?.educationRequirements?.name ||
          "",
      350
    );

    const jobUrl = absoluteUrl(json?.url || location.href);
    const detail = {
      jobId:
        clean(json?.identifier?.value, 150) ||
        jobIdFromUrl(jobUrl),
      title: valueOr(jsonTitle, dom.title),
      company: valueOr(jsonCompany, dom.company),
      experience: valueOr(jsonExperience, dom.experience),
      location: valueOr(jsonLocation, dom.location),
      salary: valueOr(jsonSalary(json?.baseSalary), dom.salary),
      skills: valueOr(jsonSkillList, dom.skills),
      description: valueOr(jsonDescription, dom.description),
      postedAge: dom.postedAge,
      datePosted: jsonPosted,
      employmentType: jsonEmployment,
      education: jsonEducation,
      jobUrl,
      sources: {
        title: jsonTitle ? "json-ld" : dom.title ? "dom" : "",
        company: jsonCompany ? "json-ld" : dom.company ? "dom" : "",
        experience: jsonExperience ? "json-ld" : dom.experience ? "dom" : "",
        location: jsonLocation ? "json-ld" : dom.location ? "dom" : "",
        salary: jsonSalary(json?.baseSalary) ? "json-ld" : dom.salary ? "dom" : "",
        skills: jsonSkillList.length ? "json-ld" : dom.skills.length ? "dom" : "",
        description: jsonDescription ? "json-ld" : dom.description ? "dom" : "",
        datePosted: jsonPosted ? "json-ld" : "",
        postedAge: dom.postedAge ? "dom" : "",
        employmentType: jsonEmployment ? "json-ld" : "",
        education: jsonEducation ? "json-ld" : "",
        jobUrl: json?.url ? "json-ld" : "current-url"
      }
    };

    detail.extraction = detailConfidence(detail);
    return detail;
  }

  function pageType() {
    const path = location.pathname.toLowerCase();

    if (
      path.includes("job-listings-") ||
      Boolean(getJsonLdJobPosting()) ||
      Boolean(
        document.querySelector(
          ".jd-header-title, [class*='jd-header-title'], .dang-inner-html, [class*='job-desc']"
        )
      )
    ) {
      return "job-detail";
    }

    if (
      /-jobs(?:-in-)?/.test(path) ||
      jobAnchors().length > 1
    ) {
      return "search-results";
    }

    return "unknown";
  }

  function buildExtraction() {
    const type = pageType();

    if (type === "job-detail") {
      const detail = extractDetail();
      return {
        version: 1,
        pageType: type,
        sourceUrl: location.href,
        cards: [],
        detail,
        stats: {
          detected: 1,
          parsed: detail.title && detail.jobUrl ? 1 : 0,
          high: detail.extraction.level === "HIGH" ? 1 : 0,
          medium: detail.extraction.level === "MEDIUM" ? 1 : 0,
          low: detail.extraction.level === "LOW" ? 1 : 0
        }
      };
    }

    if (type === "search-results") {
      const anchors = jobAnchors();
      const cards = anchors
        .map((anchor, index) => extractCard(anchor, index + 1))
        .filter(Boolean);

      const stats = {
        detected: anchors.length,
        parsed: cards.length,
        high: cards.filter((job) => job.extraction.level === "HIGH").length,
        medium: cards.filter((job) => job.extraction.level === "MEDIUM").length,
        low: cards.filter((job) => job.extraction.level === "LOW").length
      };

      return {
        version: 1,
        pageType: type,
        sourceUrl: location.href,
        cards,
        detail: null,
        stats
      };
    }

    return {
      version: 1,
      pageType: "unknown",
      sourceUrl: location.href,
      cards: [],
      detail: null,
      stats: {
        detected: 0,
        parsed: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    };
  }

  function signatureFor(data) {
    if (data.pageType === "job-detail") {
      return JSON.stringify({
        t: data.pageType,
        u: data.sourceUrl,
        j: data.detail
          ? [
              data.detail.jobId,
              data.detail.title,
              data.detail.company,
              data.detail.experience,
              data.detail.location,
              data.detail.datePosted,
              data.detail.description?.length || 0,
              data.detail.extraction?.score
            ]
          : null
      });
    }

    return JSON.stringify({
      t: data.pageType,
      u: data.sourceUrl,
      c: data.cards.map((job) => [
        job.jobId,
        job.title,
        job.company,
        job.experience,
        job.location,
        job.postedAge,
        job.extraction?.score
      ])
    });
  }

  async function persist(data) {
    const signature = signatureFor(data);
    if (signature === lastSignature) return;

    lastSignature = signature;
    await chrome.storage.local.set({
      [EXTRACTION_KEY]: {
        ...data,
        extractedAt: new Date().toISOString()
      }
    });
  }

  function renderOverlay(data) {
    if (closedForUrl === location.href) return;

    let root = document.getElementById(ROOT_ID);

    if (!root) {
      root = document.createElement("aside");
      root.id = ROOT_ID;
      root.innerHTML = [
        '<div class="jp4-head">',
        '  <div><span>JOBPILOT</span><strong>Stage 4 extraction</strong></div>',
        '  <button type="button" class="jp4-close" aria-label="Close">×</button>',
        '</div>',
        '<div class="jp4-body"></div>'
      ].join("");

      document.documentElement.appendChild(root);

      root.querySelector(".jp4-close").addEventListener("click", () => {
        closedForUrl = location.href;
        root.remove();
      });
    }

    const body = root.querySelector(".jp4-body");

    if (data.pageType === "search-results") {
      const failed = Math.max(0, data.stats.detected - data.stats.parsed);
      const sample = data.cards.slice(0, 3);

      body.innerHTML =
        '<div class="jp4-row"><span>Page</span><b>Search results</b></div>' +
        '<div class="jp4-metrics">' +
          '<div><strong>' + data.stats.detected + '</strong><span>Detected</span></div>' +
          '<div><strong>' + data.stats.parsed + '</strong><span>Parsed</span></div>' +
          '<div><strong>' + failed + '</strong><span>Failed</span></div>' +
        '</div>' +
        '<div class="jp4-levels">' +
          '<span>HIGH ' + data.stats.high + '</span>' +
          '<span>MEDIUM ' + data.stats.medium + '</span>' +
          '<span>LOW ' + data.stats.low + '</span>' +
        '</div>' +
        (sample.length
          ? '<div class="jp4-sample">' +
              sample.map((job) =>
                '<div><b>' + escapeHtml(job.title) + '</b>' +
                '<span>' + escapeHtml(job.company || "Company unknown") + '</span>' +
                '<em class="jp4-' + job.extraction.level.toLowerCase() + '">' +
                  job.extraction.level + ' ' + job.extraction.score + '/100' +
                '</em></div>'
              ).join("") +
            '</div>'
          : '<div class="jp4-note jp4-warn">No structured Naukri job cards were parsed yet.</div>') +
        '<div class="jp4-note">Extraction confidence only — this is NOT a job match score.</div>';
      return;
    }

    if (data.pageType === "job-detail" && data.detail) {
      const job = data.detail;
      const fields = [
        ["Title", job.title],
        ["Company", job.company],
        ["Experience", job.experience],
        ["Location", job.location],
        ["Salary", job.salary],
        ["Skills", Array.isArray(job.skills) ? job.skills.join(", ") : ""],
        ["Posted", job.datePosted || job.postedAge],
        ["Job ID", job.jobId]
      ];

      body.innerHTML =
        '<div class="jp4-row"><span>Page</span><b>Job detail</b></div>' +
        '<div class="jp4-confidence jp4-' + job.extraction.level.toLowerCase() + '">' +
          '<strong>' + job.extraction.level + ' ' + job.extraction.score + '/100</strong>' +
          '<span>Extraction confidence</span>' +
        '</div>' +
        '<div class="jp4-fields">' +
          fields.map(([label, value]) =>
            '<div class="' + (value ? "jp4-found" : "jp4-missing") + '">' +
              '<span>' + (value ? "✓" : "!") + '</span>' +
              '<b>' + escapeHtml(label) + '</b>' +
              '<em>' + escapeHtml(value || "Unknown") + '</em>' +
            '</div>'
          ).join("") +
        '</div>' +
        '<div class="jp4-note">Extraction confidence only — matching and AI analysis are disabled.</div>';
      return;
    }

    body.innerHTML =
      '<div class="jp4-row"><span>Page</span><b>Unknown</b></div>' +
      '<div class="jp4-note jp4-warn">Stage 4 did not identify a Naukri results or job-detail page. No job object was created.</div>';
  }

  async function runExtraction() {
    try {
      const data = buildExtraction();
      renderOverlay(data);
      await persist(data);
    } catch (error) {
      console.warn("JobPilot Stage 4 extraction failed", error);
    }
  }

  function scheduleExtraction(delay = 500) {
    clearTimeout(scheduleExtraction.timer);
    scheduleExtraction.timer = setTimeout(runExtraction, delay);
  }

  lastSignature = "";
  runExtraction();

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSignature = "";
      closedForUrl = "";
      scheduleExtraction(350);
    }
  }, 900);

  const observer = new MutationObserver((mutations) => {
    const onlyOwnOverlay = mutations.every((mutation) => {
      const target = mutation.target instanceof Element
        ? mutation.target
        : mutation.target?.parentElement;
      return target?.closest?.("#" + ROOT_ID);
    });

    if (!onlyOwnOverlay) {
      scheduleExtraction(650);
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
