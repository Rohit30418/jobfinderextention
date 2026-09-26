(() => {
  if (globalThis.__JOBPILOT_PORTAL_RUNTIME__) return;
  globalThis.__JOBPILOT_PORTAL_RUNTIME__ = true;

  const engine = globalThis.JobPilotPortalEngine;
  if (!engine) {
    console.warn("JobPilot portal engine is missing.");
    return;
  }

  const CAPTURE_KEY = "jobpilot.stage4.portalCapture";
  const CACHE_KEY = "jobpilot.jobs.cache";
  const CONNECTION_KEY = "jobpilot.stage4.connection";
  const ROOT_ID = "jobpilot-portal-stage4";
  const MAX_CACHE = 300;

  let lastSignature = "";
  let lastUrl = location.href;
  let closedForUrl = "";

  function cleanupLegacyOverlays() {
    for (const selector of [
      "#jobpilot-naukri-stage3",
      "#jobpilot-naukri-stage4"
    ]) {
      const node = document.querySelector(selector);
      if (node) node.remove();
    }
  }

  async function publishConnection(adapter, pageType) {
    try {
      await chrome.storage.local.set({
        [CONNECTION_KEY]: {
          status: "connected",
          portal: adapter?.id || "unknown",
          pageType: pageType || "unknown",
          url: location.href,
          seenAt: new Date().toISOString()
        }
      });
    } catch (_) {}
  }

  function confidenceClass(level) {
    return String(level || "LOW").toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function comparableUrl(value) {
    try {
      const url = new URL(value);
      return (url.hostname + url.pathname)
        .toLowerCase()
        .replace(/\/+$/, "");
    } catch (_) {
      return String(value || "")
        .toLowerCase()
        .split("?")[0]
        .replace(/\/+$/, "");
    }
  }

  function findExistingJobKey(cache, incoming) {
    if (!incoming) return "";

    if (incoming.key && cache[incoming.key]) {
      return incoming.key;
    }

    const incomingUrl = comparableUrl(incoming.canonicalUrl);

    for (const [key, existing] of Object.entries(cache)) {
      if (!existing || existing.portal !== incoming.portal) continue;

      if (
        incoming.portalJobId &&
        existing.portalJobId &&
        String(incoming.portalJobId) === String(existing.portalJobId)
      ) {
        return key;
      }

      if (
        incomingUrl &&
        comparableUrl(existing.canonicalUrl) === incomingUrl
      ) {
        return key;
      }
    }

    return "";
  }

  async function updateCache(jobs) {
    const result = await chrome.storage.local.get(CACHE_KEY);
    const current = result[CACHE_KEY] && typeof result[CACHE_KEY] === "object"
      ? result[CACHE_KEY]
      : {};

    for (const job of jobs) {
      const existingKey = findExistingJobKey(current, job);

      if (existingKey) {
        const merged = engine.mergeJob(current[existingKey], job);
        merged.key = existingKey;
        current[existingKey] = merged;
      } else {
        current[job.key] = engine.mergeJob(current[job.key], job);
      }
    }

    const entries = Object.entries(current)
      .sort((a, b) => {
        const at = new Date(a[1]?.capturedAt || 0).getTime();
        const bt = new Date(b[1]?.capturedAt || 0).getTime();
        return bt - at;
      })
      .slice(0, MAX_CACHE);

    const next = Object.fromEntries(entries);
    await chrome.storage.local.set({ [CACHE_KEY]: next });
    return next;
  }

  function captureSignature(data) {
    return JSON.stringify({
      portal: data.portal,
      pageType: data.pageType,
      url: data.sourceUrl,
      jobs: (data.jobs || []).map((job) => [
        job.key,
        job.title,
        job.company,
        job.experienceText,
        job.location,
        job.postedAge,
        job.extraction?.confidence?.score
      ]),
      detail: data.detail
        ? [
            data.detail.key,
            data.detail.title,
            data.detail.company,
            data.detail.description?.length || 0,
            data.detail.extraction?.confidence?.score
          ]
        : null
    });
  }

  async function persistCapture(data) {
    const signature = captureSignature(data);
    if (signature === lastSignature) return;

    lastSignature = signature;

    const allJobs = [
      ...(Array.isArray(data.jobs) ? data.jobs : []),
      ...(data.detail ? [data.detail] : [])
    ];

    if (allJobs.length) {
      await updateCache(allJobs);
    }

    await chrome.storage.local.set({
      [CAPTURE_KEY]: {
        ...data,
        capturedAt: new Date().toISOString()
      }
    });
  }

  function statsFor(jobs, detected) {
    const list = Array.isArray(jobs) ? jobs : [];

    return {
      detected: Number(detected || list.length),
      normalized: list.length,
      high: list.filter((job) => job.extraction?.confidence?.level === "HIGH").length,
      medium: list.filter((job) => job.extraction?.confidence?.level === "MEDIUM").length,
      low: list.filter((job) => job.extraction?.confidence?.level === "LOW").length
    };
  }

  function captureWithAdapter(adapter, pageType) {
    if (!adapter) {
      return {
        version: 2,
        portal: "unknown",
        adapterVersion: "",
        pageType: "unknown",
        captureMethod: "none",
        sourceUrl: location.href,
        jobs: [],
        detail: null,
        stats: statsFor([], 0)
      };
    }

    if (pageType === "listing") {
      const result = adapter.captureListing();
      const rawJobs = Array.isArray(result?.jobs) ? result.jobs : [];
      const normalizedJobs = rawJobs.map((raw) =>
        engine.normalizeJob(raw, {
          portal: adapter.id,
          pageType: "listing",
          method: result?.method || raw?.captureMethod || "unknown",
          adapterVersion: adapter.version
        })
      );

      const jobMap = new Map();
      for (const job of normalizedJobs) {
        if (!job?.key) continue;
        jobMap.set(job.key, engine.mergeJob(jobMap.get(job.key), job));
      }
      const jobs = [...jobMap.values()];

      return {
        version: 2,
        portal: adapter.id,
        portalName: adapter.displayName || adapter.id,
        adapterVersion: adapter.version || "1",
        pageType: "listing",
        captureMethod: result?.method || "unknown",
        sourceUrl: location.href,
        jobs,
        detail: null,
        stats: statsFor(jobs, result?.detected)
      };
    }

    if (pageType === "detail") {
      const result = adapter.captureDetail();
      const detail = result?.job
        ? engine.normalizeJob(result.job, {
            portal: adapter.id,
            pageType: "detail",
            method: result?.method || result.job?.captureMethod || "unknown",
            adapterVersion: adapter.version
          })
        : null;

      return {
        version: 2,
        portal: adapter.id,
        portalName: adapter.displayName || adapter.id,
        adapterVersion: adapter.version || "1",
        pageType: "detail",
        captureMethod: result?.method || "unknown",
        sourceUrl: location.href,
        jobs: [],
        detail,
        stats: statsFor(detail ? [detail] : [], detail ? 1 : 0)
      };
    }

    return {
      version: 2,
      portal: adapter.id,
      portalName: adapter.displayName || adapter.id,
      adapterVersion: adapter.version || "1",
      pageType: "unknown",
      captureMethod: "none",
      sourceUrl: location.href,
      jobs: [],
      detail: null,
      stats: statsFor([], 0)
    };
  }

  function render(data) {
    if (closedForUrl === location.href) return;

    let root = document.getElementById(ROOT_ID);

    if (!root) {
      root = document.createElement("aside");
      root.id = ROOT_ID;
      root.innerHTML = [
        '<div class="jpp-head">',
        '  <div><span>JOBPILOT</span><strong>Portal capture</strong></div>',
        '  <button class="jpp-close" type="button" aria-label="Close">×</button>',
        '</div>',
        '<div class="jpp-body"></div>'
      ].join("");

      document.documentElement.appendChild(root);

      root.querySelector(".jpp-close").addEventListener("click", () => {
        closedForUrl = location.href;
        root.remove();
      });
    }

    const body = root.querySelector(".jpp-body");
    const portalName = data.portalName || data.portal || "Unknown";

    let html =
      '<div class="jpp-row"><span>Portal</span><b>' + escapeHtml(portalName) + '</b></div>' +
      '<div class="jpp-row"><span>Page</span><b>' + escapeHtml(data.pageType) + '</b></div>' +
      '<div class="jpp-row"><span>Method</span><b>' + escapeHtml(data.captureMethod || "none") + '</b></div>';

    if (data.pageType === "listing") {
      const stats = data.stats || {};

      const relevance = data.relevanceStats || {
        relevant: 0,
        review: 0,
        filtered: 0
      };

      html +=
        '<div class="jpp-metrics">' +
          '<div><strong>' + Number(stats.detected || 0) + '</strong><span>Extracted</span></div>' +
          '<div><strong>' + Number(relevance.relevant || 0) + '</strong><span>Relevant</span></div>' +
          '<div><strong>' + Number(relevance.filtered || 0) + '</strong><span>Filtered</span></div>' +
        '</div>' +
        '<div class="jpp-levels">' +
          '<span>RELEVANT ' + Number(relevance.relevant || 0) + '</span>' +
          '<span>REVIEW ' + Number(relevance.review || 0) + '</span>' +
          '<span>FILTERED ' + Number(relevance.filtered || 0) + '</span>' +
        '</div>';

      const sample = (data.jobs || [])
        .filter((job) => job.relevance?.status !== "filtered")
        .slice(0, 3);

      if (sample.length) {
        html +=
          '<div class="jpp-sample">' +
            sample.map((job) => {
              const confidence = job.extraction?.confidence || {};
              return (
                '<div>' +
                  '<b>' + escapeHtml(job.title || "Untitled") + '</b>' +
                  '<span>' + escapeHtml(job.company || "Company unknown") + '</span>' +
                  '<em class="jpp-' + confidenceClass(confidence.level) + '">' +
                    escapeHtml((job.relevance?.status || "review").toUpperCase()) +
                  '</em>' +
                '</div>'
              );
            }).join("") +
          '</div>';
      } else {
        html += '<div class="jpp-note jpp-warn">No normalized jobs captured yet.</div>';
      }

      html += '<div class="jpp-note">Listing capture only. No job-match score is being calculated.</div>';
    } else if (data.pageType === "detail" && data.detail) {
      const job = data.detail;
      const confidence = job.extraction?.confidence || {};

      html +=
        '<div class="jpp-confidence jpp-' + confidenceClass(confidence.level) + '">' +
          '<strong>' + escapeHtml("Extraction " + (confidence.level || "LOW")) + '</strong>' +
          '<span>Completeness ' + Number(confidence.score || 0) + '% · not a match score</span>' +
        '</div>' +
        '<div class="jpp-fields">' +
          [
            ["Title", job.title],
            ["Company", job.company],
            ["Experience", job.experienceText],
            ["Location", job.location],
            ["Salary", job.salaryText],
            ["Skills", (job.skills || []).join(", ")],
            ["Posted", job.datePosted || job.postedAge],
            ["Job ID", job.portalJobId]
          ].map(([label, value]) =>
            '<div class="' + (value ? "jpp-found" : "jpp-missing") + '">' +
              '<span>' + (value ? "✓" : "!") + '</span>' +
              '<b>' + escapeHtml(label) + '</b>' +
              '<em>' + escapeHtml(value || "Unknown") + '</em>' +
            '</div>'
          ).join("") +
        '</div>' +
        '<div class="jpp-note">' +
          'Enriched: ' +
          Number(job.requiredSkills?.length || 0) + ' required skill(s) · ' +
          Number(job.preferredSkills?.length || 0) + ' preferred skill(s) · ' +
          Number(job.responsibilities?.length || 0) + ' responsibility item(s).' +
        '</div>' +
        '<div class="jpp-note">Stage 4C enrichment only. Matching and AI analysis are disabled.</div>';
    } else {
      html += '<div class="jpp-note jpp-warn">This portal page is not recognized as a listing or job-detail page.</div>';
    }

    body.innerHTML = html;
  }

  async function run() {
    try {
      cleanupLegacyOverlays();
      const adapter = engine.detectAdapter(location.href);
      const pageType = adapter?.detectPage?.() || "unknown";

      await publishConnection(adapter, pageType);

      const data = captureWithAdapter(adapter, pageType);

      if (data.pageType === "listing" && globalThis.JobPilotRelevanceGate) {
        const prefResult = await chrome.storage.local.get("jobpilot.stage2.preferences");
        const preferences = prefResult["jobpilot.stage2.preferences"] || {};
        const annotated = globalThis.JobPilotRelevanceGate.annotateJobs(data.jobs, preferences);
        data.jobs = annotated.jobs;
        data.relevanceStats = annotated.stats;
      }

      render(data);
      await persistCapture(data);
    } catch (error) {
      console.warn("JobPilot portal runtime failed", error);
    }
  }

  function schedule(delay = 450) {
    clearTimeout(schedule.timer);
    schedule.timer = setTimeout(run, delay);
  }

  cleanupLegacyOverlays();
  run();

  setInterval(() => {
    cleanupLegacyOverlays();
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSignature = "";
      closedForUrl = "";
      schedule(300);
    }
  }, 900);

  const observer = new MutationObserver((mutations) => {
    cleanupLegacyOverlays();

    const onlyOwn = mutations.every((mutation) => {
      const target = mutation.target instanceof Element
        ? mutation.target
        : mutation.target?.parentElement;

      return target?.closest?.("#" + ROOT_ID);
    });

    if (!onlyOwn) schedule(650);
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
