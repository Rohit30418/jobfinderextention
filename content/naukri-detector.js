(() => {
  if (globalThis.__JOBPILOT_STAGE3_ACTIVE__) {
    return;
  }
  globalThis.__JOBPILOT_STAGE3_ACTIVE__ = true;

  const CONNECTION_KEY = "jobpilot.stage3.connection";

  function publishConnection(status = "connected") {
    try {
      chrome.storage.local.set({
        [CONNECTION_KEY]: {
          status,
          url: location.href,
          seenAt: new Date().toISOString()
        }
      });
    } catch (_) {}
  }

  publishConnection();
  const SEARCH_KEY = "jobpilot.stage3.naukriSearch";
  const NATIVE_KEY = "jobpilot.stage3.naukriNativeFilters";
  const ROOT_ID = "jobpilot-naukri-stage3";

  let lastUrl = "";
  let closedForUrl = "";

  function norm(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function arraysEqual(a, b) {
    const left = (Array.isArray(a) ? a : []).map(String);
    const right = (Array.isArray(b) ? b : []).map(String);

    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
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
    const selectors = [
      ".srp-jobtuple-wrapper h2 a.title",
      ".cust-job-tuple h2 a.title",
      "h2 a.title",
      "a.title",
      'a[href*="job-listings"]'
    ];

    for (const selector of selectors) {
      let anchors = [];
      try {
        anchors = Array.from(document.querySelectorAll(selector));
      } catch (_) {}

      for (const anchor of anchors) {
        try {
          const url = new URL(anchor.href, location.href);
          const nearby = anchor.closest(
            ".cust-job-tuple, .srp-jobtuple-wrapper, [class*='jobTuple'], [class*='job-tuple'], article"
          );

          if (
            url.hostname.endsWith("naukri.com") &&
            (nearby || /job-listings/i.test(url.pathname))
          ) {
            set.add(url.href.split("?")[0]);
          }
        } catch (_) {}
      }

      if (set.size >= 2) break;
    }

    return [...set];
  }

  function detectPageType() {
    const path = location.pathname.toLowerCase();
    const href = location.href.toLowerCase();
    const bodyText = norm(
      (document.body && document.body.innerText || "").slice(0, 120000)
    );

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

    const params = new URLSearchParams(location.search);
    const jobLinks = uniqueJobLinks();

    const strongSearchEvidence =
      /-jobs(?:-in-)?/.test(path) ||
      jobLinks.length >= 2 ||
      params.has("k") ||
      params.has("l") ||
      params.has("jobAge") ||
      params.has("experience") ||
      params.has("cityTypeGid");

    // Search pages contain job-card classes such as job-desc too, so
    // search evidence must win before any generic DOM selector.
    if (strongSearchEvidence && !path.includes("job-listings-")) {
      return { type: "search-results", label: "Naukri search results" };
    }

    const strongDetailEvidence =
      path.includes("job-listings-") ||
      (
        Boolean(getJsonLdJobPosting()) &&
        jobLinks.length <= 1 &&
        Boolean(
          document.querySelector(
            '[class*="jd-header"], [class*="jobDescription"], .dang-inner-html'
          )
        )
      );

    if (strongDetailEvidence) {
      return { type: "job-detail", label: "Individual job page" };
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

      if (
        rules.some((rule) => rule.test(haystack)) &&
        String(input.value || "").trim()
      ) {
        return String(input.value).trim();
      }
    }

    return "";
  }

  async function captureNativeFilters(session, previousNative) {
    if (!session || !session.createdAt) return previousNative;

    const params = new URLSearchParams(location.search);
    const experienceValue = params.get("experience") || "";
    const cityTypeGids = params.getAll("cityTypeGid").filter(Boolean);

    if (!experienceValue && !cityTypeGids.length) {
      return previousNative;
    }

    const next = {
      version: 1,
      experienceValue:
        experienceValue ||
        String(previousNative?.experienceValue || ""),
      experienceContextKey:
        experienceValue
          ? String(session.experienceContextKey || "")
          : String(previousNative?.experienceContextKey || ""),
      cityTypeGids:
        cityTypeGids.length
          ? cityTypeGids
          : Array.isArray(previousNative?.cityTypeGids)
            ? previousNative.cityTypeGids
            : [],
      locationContextKey:
        cityTypeGids.length
          ? String(session.locationContextKey || "")
          : String(previousNative?.locationContextKey || ""),
      sourceUrl: location.href,
      learnedAt: previousNative?.learnedAt || null
    };

    const changed =
      String(previousNative?.experienceValue || "") !== next.experienceValue ||
      String(previousNative?.experienceContextKey || "") !== next.experienceContextKey ||
      !arraysEqual(previousNative?.cityTypeGids, next.cityTypeGids) ||
      String(previousNative?.locationContextKey || "") !== next.locationContextKey;

    if (!changed) {
      return previousNative;
    }

    next.learnedAt = new Date().toISOString();

    await chrome.storage.local.set({
      [NATIVE_KEY]: next
    });

    return next;
  }

  function makeCheck(label, requested, observed, status, source) {
    return {
      label,
      requested,
      observed,
      status,
      source
    };
  }

  function pathContainsSearch(session) {
    const expected = slugify(session.keywords || session.primaryRole || "");
    const path = location.pathname.toLowerCase();

    return Boolean(expected) && path.includes("/" + expected + "-jobs");
  }

  function pathContainsPrimaryLocation(session) {
    if (!Array.isArray(session.locations) || !session.locations.length) {
      return true;
    }

    const expected = slugify(session.locations[0]);
    const path = location.pathname.toLowerCase();

    return Boolean(expected) && path.includes("-jobs-in-" + expected);
  }

  function verifySearch(session, native) {
    const params = new URLSearchParams(location.search);
    const keywordParam = params.get("k") || "";
    const locationParam = params.get("l") || "";
    const experienceParam = params.get("experience") || "";
    const ageParam = params.get("jobAge") || "";
    const cityParams = params.getAll("cityTypeGid").filter(Boolean);

    const keywordDom = findInputValue("keyword");
    const locationDom = findInputValue("location");

    const checks = [];
    const requestedKeyword = session.keywords || session.primaryRole || "";

    checks.push(
      makeCheck(
        "Search keywords",
        requestedKeyword,
        keywordParam || keywordDom || location.pathname,
        keywordParam && norm(keywordParam) === norm(requestedKeyword)
          ? "verified"
          : keywordDom && norm(keywordDom) === norm(requestedKeyword)
            ? "verified"
            : pathContainsSearch(session)
              ? "verified"
              : "unverified",
        keywordParam
          ? "URL k"
          : keywordDom
            ? "Page input"
            : pathContainsSearch(session)
              ? "URL path"
              : "None"
      )
    );

    if (Array.isArray(session.locations) && session.locations.length) {
      const requestedLocations = session.locations.join(", ");
      checks.push(
        makeCheck(
          "Location",
          requestedLocations,
          locationParam || locationDom || location.pathname,
          locationParam && norm(locationParam) === norm(requestedLocations)
            ? "verified"
            : locationDom &&
                session.locations.every((item) =>
                  norm(locationDom).includes(norm(item))
                )
              ? "verified"
              : pathContainsPrimaryLocation(session) && session.locations.length === 1
                ? "verified"
                : "unverified",
          locationParam
            ? "URL l"
            : locationDom
              ? "Page input"
              : pathContainsPrimaryLocation(session)
                ? "URL path"
                : "None"
        )
      );
    } else {
      checks.push(
        makeCheck(
          "Location",
          "No restriction",
          "Not requested",
          "neutral",
          "Stage 2"
        )
      );
    }

    const expectedNativeExperience =
      native &&
      native.experienceContextKey === session.experienceContextKey
        ? String(native.experienceValue || "")
        : "";

    if (session.experienceMin !== null || session.experienceMax !== null) {
      checks.push(
        makeCheck(
          "Experience",
          expectedNativeExperience
            ? "Naukri value " + expectedNativeExperience
            : "Desired " +
              String(session.experienceMin ?? "any") +
              "–" +
              String(session.experienceMax ?? "any") +
              " years",
          experienceParam || "Not encoded yet",
          expectedNativeExperience && experienceParam === expectedNativeExperience
            ? "verified"
            : experienceParam
              ? "verified"
              : "unverified",
          experienceParam
            ? expectedNativeExperience
              ? "URL · learned value"
              : "URL · captured from Naukri"
            : "None"
        )
      );
    } else {
      checks.push(
        makeCheck(
          "Experience",
          "No restriction",
          "Not requested",
          "neutral",
          "Stage 2"
        )
      );
    }

    if (session.naukriJobAge) {
      checks.push(
        makeCheck(
          "Freshness",
          "jobAge=" + session.naukriJobAge,
          ageParam ? "jobAge=" + ageParam : "Not found",
          ageParam === String(session.naukriJobAge)
            ? "verified"
            : "unverified",
          ageParam ? "URL" : "None"
        )
      );
    } else {
      checks.push(
        makeCheck(
          "Freshness",
          "Any time",
          "Not requested",
          "neutral",
          "Stage 2"
        )
      );
    }

    const expectedCities =
      native &&
      native.locationContextKey === session.locationContextKey &&
      Array.isArray(native.cityTypeGids)
        ? native.cityTypeGids.map(String)
        : [];

    if (expectedCities.length || cityParams.length) {
      checks.push(
        makeCheck(
          "City filters",
          expectedCities.length
            ? expectedCities.map((gid) => "cityTypeGid=" + gid).join(", ")
            : "Native Naukri city filters",
          cityParams.length
            ? cityParams.map((gid) => "cityTypeGid=" + gid).join(", ")
            : "Not found",
          expectedCities.length
            ? arraysEqual(expectedCities, cityParams)
              ? "verified"
              : "unverified"
            : cityParams.length
              ? "verified"
              : "unverified",
          cityParams.length
            ? expectedCities.length
              ? "URL · learned values"
              : "URL · captured from Naukri"
            : "None"
        )
      );
    } else if (Array.isArray(session.locations) && session.locations.length > 1) {
      checks.push(
        makeCheck(
          "City filters",
          "Additional preferred locations",
          "Not encoded yet",
          "unverified",
          "Apply Naukri city filters once"
        )
      );
    }

    return checks;
  }

  function statusIcon(status) {
    if (status === "verified") return "✓";
    if (status === "unverified") return "!";
    return "–";
  }

  function render(session, native) {
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
      escapeHtml(page.type) +
      '">' +
      escapeHtml(page.label) +
      "</b></div>";

    if (!session || !session.createdAt) {
      html +=
        '<div class="jp-note">No Stage 3 search session is stored. Open JobPilot and start a Naukri search to verify filters.</div>';
      body.innerHTML = html;
      return;
    }

    if (page.type === "search-results") {
      const checks = verifySearch(session, native);

      html +=
        '<div class="jp-count"><span>Visible job links</span><b>' +
        links.length +
        "</b></div>";

      if (
        native &&
        native.learnedAt &&
        native.sourceUrl === location.href
      ) {
        html +=
          '<div class="jp-note jp-ok">Captured Naukri-native filter values from this URL for future searches.</div>';
      }

      html +=
        '<div class="jp-checks">' +
        checks.map((check) =>
          '<div class="jp-check jp-' + check.status + '">' +
            '<div class="jp-check-top">' +
              '<span class="jp-icon">' + statusIcon(check.status) + "</span>" +
              "<strong>" + escapeHtml(check.label) + "</strong>" +
              "<em>" + escapeHtml(check.source) + "</em>" +
            "</div>" +
            '<div class="jp-values">' +
              "<span>Wanted: " + escapeHtml(check.requested) + "</span>" +
              "<span>Found: " + escapeHtml(check.observed) + "</span>" +
            "</div>" +
          "</div>"
        ).join("") +
        "</div>";

      if (checks.some((check) => check.status === "unverified")) {
        html +=
          '<div class="jp-note jp-warn">One or more filters are not encoded/verified yet. JobPilot is not guessing Naukri values.</div>';
      } else {
        html +=
          '<div class="jp-note jp-ok">Requested filters visible in the real Naukri URL are verified. Stage 3 still does not score jobs.</div>';
      }
    } else if (page.type === "job-detail") {
      html +=
        '<div class="jp-note">Job detail detected. Filter verification belongs to the search-results page; scoring is intentionally disabled in Stage 3.</div>';
    } else if (page.type === "login") {
      html +=
        '<div class="jp-note jp-warn">Naukri authentication page detected. Complete login, then return to the search.</div>';
    } else if (page.type === "not-found") {
      html +=
        '<div class="jp-note jp-warn">This page looks expired or unavailable. No match result will be produced.</div>';
    } else {
      html +=
        '<div class="jp-note jp-warn">JobPilot does not recognize this Naukri page yet. No assumptions or scores are produced.</div>';
    }

    body.innerHTML = html;
  }

  async function update() {
    try {
      const result = await chrome.storage.local.get([
        SEARCH_KEY,
        NATIVE_KEY
      ]);

      const session = result[SEARCH_KEY] || null;
      let native = result[NATIVE_KEY] || null;

      if (detectPageType().type === "search-results") {
        native = await captureNativeFilters(session, native);
      }

      render(session, native);
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
    if (
      area === "local" &&
      (changes[SEARCH_KEY] || changes[NATIVE_KEY])
    ) {
      update();
    }
  });
})();
