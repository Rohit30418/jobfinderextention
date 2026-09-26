(() => {
  const SEARCH_KEY = "jobpilot.stage3.naukriSearch";
  const ROOT_ID = "jobpilot-naukri-stage3";
  let lastUrl = "";
  let closedForUrl = "";

  function norm(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getJsonLdJobPosting() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent || "null");
        const values = Array.isArray(parsed) ? parsed : [parsed];
        const stack = [...values];

        while (stack.length) {
          const item = stack.shift();
          if (!item || typeof item !== "object") continue;

          if (item["@type"] === "JobPosting") return item;
          if (Array.isArray(item["@graph"])) stack.push(...item["@graph"]);
        }
      } catch (_) {}
    }
    return null;
  }

  function uniqueJobLinks() {
    const set = new Set();
    document.querySelectorAll('a[href*="job-listings"]').forEach((anchor) => {
      try {
        const url = new URL(anchor.href, location.href);
        if (url.hostname.endsWith("naukri.com")) set.add(url.href.split("?")[0]);
      } catch (_) {}
    });
    return [...set];
  }

  function detectPageType() {
    const path = location.pathname.toLowerCase();
    const href = location.href.toLowerCase();
    const bodyText = norm((document.body && document.body.innerText || "").slice(0, 120000));

    const loginByUrl =
      path.includes("nlogin") ||
      path.includes("/login") ||
      href.includes("login?") ||
      href.includes("login=true");

    const loginByDom = Boolean(
      document.querySelector('input[type="password"]') &&
      /login|sign in|sign-in/.test(bodyText)
    );

    if (loginByUrl || loginByDom) {
      return { type: "login", label: "Login / authentication page" };
    }

    const expiredPhrases = [
      "job is no longer available",
      "job no longer available",
      "job has expired",
      "job expired",
      "this job is no longer accepting applications",
      "page not found",
      "404 - page not found",
      "we couldn't find the page",
      "we could not find the page"
    ];

    if (expiredPhrases.some((phrase) => bodyText.includes(phrase))) {
      return { type: "not-found", label: "Expired / not-found page" };
    }

    if (
      path.includes("job-listings-") ||
      Boolean(getJsonLdJobPosting()) ||
      Boolean(document.querySelector('[class*="job-desc"], [class*="jd-header"], [class*="jobDescription"]'))
    ) {
      return { type: "job-detail", label: "Individual job page" };
    }

    const params = new URLSearchParams(location.search);
    const jobLinks = uniqueJobLinks();

    if (
      params.has("k") ||
      params.has("l") ||
      params.has("jobAge") ||
      params.has("experience") ||
      /-jobs(?:-in-)?/.test(path) ||
      jobLinks.length >= 2
    ) {
      return { type: "search-results", label: "Naukri search results" };
    }

    return { type: "unknown", label: "Unknown Naukri page" };
  }

  function findInputValue(kind) {
    const inputs = Array.from(document.querySelectorAll("input"));
    const rules = kind === "keyword"
      ? [/skill/i, /designation/i, /keyword/i, /company/i]
      : [/location/i, /city/i];

    for (const input of inputs) {
      const haystack = [
        input.getAttribute("placeholder"),
        input.getAttribute("name"),
        input.getAttribute("aria-label"),
        input.id
      ].filter(Boolean).join(" ");

      if (rules.some((rule) => rule.test(haystack)) && String(input.value || "").trim()) {
        return String(input.value).trim();
      }
    }

    return "";
  }

  function equivalentExperience(expectedMin, expectedMax, actual) {
    if (expectedMin === null && expectedMax === null) return true;
    const normalized = String(actual || "").replace(/\s+/g, "");

    if (expectedMin !== null && expectedMax !== null) {
      return normalized === expectedMin + "-" + expectedMax;
    }

    if (expectedMin !== null) {
      return normalized === String(expectedMin) || normalized === expectedMin + "+";
    }

    return normalized === "0-" + expectedMax || normalized === String(expectedMax);
  }

  function locationMatches(expected, actualValue) {
    if (!expected.length) return true;
    const actual = norm(actualValue);
    if (!actual) return false;

    return expected.every((location) => actual.includes(norm(location)));
  }

  function makeCheck(label, requested, observed, status, source) {
    return { label, requested, observed, status, source };
  }

  function verifySearch(session) {
    const params = new URLSearchParams(location.search);
    const keywordParam = params.get("k") || "";
    const locationParam = params.get("l") || "";
    const experienceParam = params.get("experience") || "";
    const ageParam = params.get("jobAge") || "";

    const keywordDom = findInputValue("keyword");
    const locationDom = findInputValue("location");

    const checks = [];

    const keywordObserved = keywordParam || keywordDom;
    checks.push(makeCheck(
      "Keyword",
      session.keywords || session.primaryRole || "",
      keywordObserved || "Not found",
      keywordObserved && norm(keywordObserved) === norm(session.keywords || session.primaryRole)
        ? "verified"
        : "unverified",
      keywordParam ? "URL" : keywordDom ? "Page input" : "None"
    ));

    if (Array.isArray(session.locations) && session.locations.length) {
      const observed = locationParam || locationDom;
      checks.push(makeCheck(
        "Location",
        session.locations.join(", "),
        observed || "Not found",
        locationMatches(session.locations, observed) ? "verified" : "unverified",
        locationParam ? "URL" : locationDom ? "Page input" : "None"
      ));
    } else {
      checks.push(makeCheck("Location", "No restriction", "Not requested", "neutral", "Stage 2"));
    }

    const expRequested =
      session.experienceMin === null && session.experienceMax === null
        ? "No restriction"
        : session.experienceMin !== null && session.experienceMax !== null
          ? session.experienceMin + "-" + session.experienceMax + " years"
          : session.experienceMin !== null
            ? session.experienceMin + "+ years"
            : "0-" + session.experienceMax + " years";

    if (session.experienceMin !== null || session.experienceMax !== null) {
      checks.push(makeCheck(
        "Experience",
        expRequested,
        experienceParam || "Not found",
        equivalentExperience(session.experienceMin, session.experienceMax, experienceParam)
          ? "verified"
          : "unverified",
        experienceParam ? "URL" : "None"
      ));
    } else {
      checks.push(makeCheck("Experience", "No restriction", "Not requested", "neutral", "Stage 2"));
    }

    if (session.naukriJobAge) {
      checks.push(makeCheck(
        "Freshness",
        "jobAge=" + session.naukriJobAge,
        ageParam ? "jobAge=" + ageParam : "Not found",
        ageParam === String(session.naukriJobAge) ? "verified" : "unverified",
        ageParam ? "URL" : "None"
      ));
    } else {
      checks.push(makeCheck("Freshness", "Any time", "Not requested", "neutral", "Stage 2"));
    }

    return checks;
  }

  function statusIcon(status) {
    if (status === "verified") return "✓";
    if (status === "unverified") return "!";
    return "–";
  }

  function render(session) {
    if (closedForUrl === location.href) return;

    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("aside");
      root.id = ROOT_ID;
      root.innerHTML = [
        '<div class="jp-head">',
        '  <div><span>JOBPILOT</span><strong>Stage 3 verification</strong></div>',
        '  <button type="button" class="jp-close" aria-label="Close">×</button>',
        '</div>',
        '<div class="jp-body"></div>'
      ].join("");
      document.documentElement.appendChild(root);

      root.querySelector(".jp-close").addEventListener("click", () => {
        closedForUrl = location.href;
        root.remove();
      });
    }

    const page = detectPageType();
    const body = root.querySelector(".jp-body");
    const links = uniqueJobLinks();

    let html =
      '<div class="jp-page"><span>Page</span><b class="jp-' +
      escapeHtml(page.type) + '">' + escapeHtml(page.label) + '</b></div>';

    if (!session || !session.createdAt) {
      html += '<div class="jp-note">No Stage 3 search session is stored. Open JobPilot and start a Naukri search to verify filters.</div>';
      body.innerHTML = html;
      return;
    }

    if (page.type === "search-results") {
      const checks = verifySearch(session);
      html += '<div class="jp-count"><span>Visible job links</span><b>' + links.length + '</b></div>';
      html += '<div class="jp-checks">' + checks.map((check) =>
        '<div class="jp-check jp-' + check.status + '">' +
          '<div class="jp-check-top"><span class="jp-icon">' + statusIcon(check.status) + '</span><strong>' + escapeHtml(check.label) + '</strong><em>' + escapeHtml(check.source) + '</em></div>' +
          '<div class="jp-values"><span>Wanted: ' + escapeHtml(check.requested) + '</span><span>Found: ' + escapeHtml(check.observed) + '</span></div>' +
        '</div>'
      ).join("") + '</div>';

      if (checks.some((check) => check.status === "unverified")) {
        html += '<div class="jp-note jp-warn">One or more filters could not be verified. JobPilot is not assuming they worked.</div>';
      } else {
        html += '<div class="jp-note jp-ok">Requested URL filters are present. Stage 3 still does not score jobs.</div>';
      }
    } else if (page.type === "job-detail") {
      html += '<div class="jp-note">Job detail detected. Filter verification belongs to the search-results page; scoring is intentionally disabled in Stage 3.</div>';
    } else if (page.type === "login") {
      html += '<div class="jp-note jp-warn">Naukri authentication page detected. Complete login, then return to the search.</div>';
    } else if (page.type === "not-found") {
      html += '<div class="jp-note jp-warn">This page looks expired or unavailable. No match result will be produced.</div>';
    } else {
      html += '<div class="jp-note jp-warn">JobPilot does not recognize this Naukri page yet. No assumptions or scores are produced.</div>';
    }

    body.innerHTML = html;
  }

  async function update() {
    try {
      const result = await chrome.storage.local.get(SEARCH_KEY);
      render(result[SEARCH_KEY] || null);
    } catch (_) {}
  }

  function checkRoute() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      closedForUrl = "";
      setTimeout(update, 450);
    }
  }

  lastUrl = location.href;
  update();

  setInterval(checkRoute, 1000);

  const observer = new MutationObserver(() => {
    clearTimeout(observer._jpTimer);
    observer._jpTimer = setTimeout(update, 500);
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SEARCH_KEY]) {
      update();
    }
  });
})();
