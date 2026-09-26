export const STATE_KEY = "jobpilot.stage1.state";
export const PUTER_TOKEN_KEY = "jobpilot.puter.token";
export const PUTER_AI_AUTH_KEY = "jobpilot.puter.ai.authorized";
export const PREFERENCES_KEY = "jobpilot.stage2.preferences";
export const NAUKRI_SEARCH_KEY = "jobpilot.stage3.naukriSearch";
export const NAUKRI_NATIVE_FILTERS_KEY = "jobpilot.stage3.naukriNativeFilters";
export const NAUKRI_EXTRACTION_KEY = "jobpilot.stage4.naukriExtraction";
export const PORTAL_CAPTURE_KEY = "jobpilot.stage4.portalCapture";
export const JOB_CACHE_KEY = "jobpilot.jobs.cache";

export function emptyState() {
  return {
    version: 1,
    resume: null,
    profile: null,
    updatedAt: null
  };
}

export async function getState() {
  const result = await chrome.storage.local.get(STATE_KEY);
  return result[STATE_KEY] || emptyState();
}

export async function setState(state) {
  const next = {
    ...emptyState(),
    ...state,
    version: 1,
    updatedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [STATE_KEY]: next });
  return next;
}

export async function clearState() {
  await chrome.storage.local.remove(STATE_KEY);
}

export async function getPuterToken() {
  const result = await chrome.storage.local.get(PUTER_TOKEN_KEY);
  return result[PUTER_TOKEN_KEY] || "";
}

export async function setPuterToken(token) {
  await chrome.storage.local.set({ [PUTER_TOKEN_KEY]: token || "" });
}

export async function clearPuterToken() {
  await chrome.storage.local.remove([PUTER_TOKEN_KEY, PUTER_AI_AUTH_KEY]);
}

export async function getAiAuthorized() {
  const result = await chrome.storage.local.get(PUTER_AI_AUTH_KEY);
  return result[PUTER_AI_AUTH_KEY] === true;
}

export async function setAiAuthorized(value) {
  await chrome.storage.local.set({ [PUTER_AI_AUTH_KEY]: value === true });
}


export function emptyPreferences() {
  return {
    version: 1,
    targetRoles: [],
    priorityKeywords: [],
    preferredLocations: [],
    experienceMin: null,
    experienceMax: null,
    workModes: [],
    employmentTypes: [],
    freshness: "3d",
    excludedKeywords: [],
    minimumSalary: null,
    salaryCurrency: "INR",
    strictFreshness: true,
    strictExperience: false,
    hideExcludedTitles: true,
    updatedAt: null
  };
}

export async function getPreferences() {
  const result = await chrome.storage.local.get(PREFERENCES_KEY);
  return result[PREFERENCES_KEY] || emptyPreferences();
}

export async function setPreferences(preferences) {
  const next = {
    ...emptyPreferences(),
    ...preferences,
    version: 1,
    updatedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [PREFERENCES_KEY]: next });
  return next;
}

export async function clearPreferences() {
  await chrome.storage.local.remove(PREFERENCES_KEY);
}


export function emptyNaukriSearch() {
  return {
    version: 1,
    primaryRole: "",
    keywords: "",
    locations: [],
    experienceMin: null,
    experienceMax: null,
    requestedFreshness: "any",
    naukriJobAge: null,
    url: "",
    createdAt: null
  };
}

export async function getNaukriSearch() {
  const result = await chrome.storage.local.get(NAUKRI_SEARCH_KEY);
  return result[NAUKRI_SEARCH_KEY] || emptyNaukriSearch();
}

export async function setNaukriSearch(search) {
  const next = {
    ...emptyNaukriSearch(),
    ...search,
    version: 1,
    createdAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [NAUKRI_SEARCH_KEY]: next });
  return next;
}

export async function clearNaukriSearch() {
  await chrome.storage.local.remove(NAUKRI_SEARCH_KEY);
}


export function emptyNaukriNativeFilters() {
  return {
    version: 1,
    experienceValue: "",
    experienceContextKey: "",
    cityTypeGids: [],
    locationContextKey: "",
    sourceUrl: "",
    learnedAt: null
  };
}

export async function getNaukriNativeFilters() {
  const result = await chrome.storage.local.get(NAUKRI_NATIVE_FILTERS_KEY);
  return result[NAUKRI_NATIVE_FILTERS_KEY] || emptyNaukriNativeFilters();
}

export async function setNaukriNativeFilters(filters) {
  const next = {
    ...emptyNaukriNativeFilters(),
    ...filters,
    version: 1,
    learnedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [NAUKRI_NATIVE_FILTERS_KEY]: next });
  return next;
}

export async function clearNaukriNativeFilters() {
  await chrome.storage.local.remove(NAUKRI_NATIVE_FILTERS_KEY);
}


export function emptyNaukriExtraction() {
  return {
    version: 1,
    pageType: "unknown",
    sourceUrl: "",
    cards: [],
    detail: null,
    stats: {
      detected: 0,
      parsed: 0,
      high: 0,
      medium: 0,
      low: 0
    },
    extractedAt: null
  };
}

export async function getNaukriExtraction() {
  const result = await chrome.storage.local.get(NAUKRI_EXTRACTION_KEY);
  return result[NAUKRI_EXTRACTION_KEY] || emptyNaukriExtraction();
}

export async function setNaukriExtraction(extraction) {
  const next = {
    ...emptyNaukriExtraction(),
    ...extraction,
    version: 1,
    extractedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [NAUKRI_EXTRACTION_KEY]: next });
  return next;
}

export async function clearNaukriExtraction() {
  await chrome.storage.local.remove(NAUKRI_EXTRACTION_KEY);
}


export function emptyPortalCapture() {
  return {
    version: 2,
    portal: "",
    portalName: "",
    adapterVersion: "",
    pageType: "unknown",
    captureMethod: "none",
    sourceUrl: "",
    jobs: [],
    detail: null,
    stats: {
      detected: 0,
      normalized: 0,
      high: 0,
      medium: 0,
      low: 0
    },
    capturedAt: null
  };
}

export async function getPortalCapture() {
  const result = await chrome.storage.local.get(PORTAL_CAPTURE_KEY);
  return result[PORTAL_CAPTURE_KEY] || emptyPortalCapture();
}

export async function setPortalCapture(capture) {
  const next = {
    ...emptyPortalCapture(),
    ...capture,
    version: 2,
    capturedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [PORTAL_CAPTURE_KEY]: next });
  return next;
}

export async function clearPortalCapture() {
  await chrome.storage.local.remove(PORTAL_CAPTURE_KEY);
}

export async function getJobCache() {
  const result = await chrome.storage.local.get(JOB_CACHE_KEY);
  const value = result[JOB_CACHE_KEY];
  return value && typeof value === "object" ? value : {};
}

export async function clearJobCache() {
  await chrome.storage.local.remove(JOB_CACHE_KEY);
}


export async function saveJobAiAnalysis(jobKey, analysis) {
  const result = await chrome.storage.local.get([
    JOB_CACHE_KEY,
    PORTAL_CAPTURE_KEY
  ]);

  const cache =
    result[JOB_CACHE_KEY] && typeof result[JOB_CACHE_KEY] === "object"
      ? result[JOB_CACHE_KEY]
      : {};

  const capture =
    result[PORTAL_CAPTURE_KEY] && typeof result[PORTAL_CAPTURE_KEY] === "object"
      ? result[PORTAL_CAPTURE_KEY]
      : emptyPortalCapture();

  const detail = capture.detail || null;
  const requestedKey = String(jobKey || detail?.key || "").trim();

  if (!requestedKey && !detail) {
    throw new Error("No current detail job is available for AI enrichment.");
  }

  let cacheKey = requestedKey;

  if (!cache[cacheKey] && detail) {
    const detailUrl = String(detail.canonicalUrl || "").split("?")[0].replace(/\/+$/, "");
    const detailId = String(detail.portalJobId || "");

    for (const [key, item] of Object.entries(cache)) {
      if (!item || item.portal !== detail.portal) continue;

      const sameId =
        detailId &&
        item.portalJobId &&
        String(item.portalJobId) === detailId;

      const itemUrl = String(item.canonicalUrl || "").split("?")[0].replace(/\/+$/, "");
      const sameUrl =
        detailUrl &&
        itemUrl &&
        itemUrl.toLowerCase() === detailUrl.toLowerCase();

      if (sameId || sameUrl) {
        cacheKey = key;
        break;
      }
    }
  }

  const analyzedAt =
    analysis?.analyzedAt || new Date().toISOString();

  if (cache[cacheKey]) {
    cache[cacheKey] = {
      ...cache[cacheKey],
      aiAnalysis: analysis || null,
      aiAnalyzedAt: analyzedAt
    };
  }

  if (detail) {
    capture.detail = {
      ...detail,
      aiAnalysis: analysis || null,
      aiAnalyzedAt: analyzedAt
    };
  }

  await chrome.storage.local.set({
    [JOB_CACHE_KEY]: cache,
    [PORTAL_CAPTURE_KEY]: capture
  });

  return capture.detail || cache[cacheKey] || null;
}


export async function saveJobDeepMatch(jobKey, deepMatch) {
  const result = await chrome.storage.local.get([
    JOB_CACHE_KEY,
    PORTAL_CAPTURE_KEY
  ]);

  const cache =
    result[JOB_CACHE_KEY] && typeof result[JOB_CACHE_KEY] === "object"
      ? result[JOB_CACHE_KEY]
      : {};

  const capture =
    result[PORTAL_CAPTURE_KEY] && typeof result[PORTAL_CAPTURE_KEY] === "object"
      ? result[PORTAL_CAPTURE_KEY]
      : emptyPortalCapture();

  const detail = capture.detail || null;
  const requestedKey = String(jobKey || detail?.key || "").trim();

  if (!requestedKey && !detail) {
    throw new Error("No current detail job is available for Stage 5.");
  }

  let cacheKey = requestedKey;

  if (!cache[cacheKey] && detail) {
    const detailUrl = String(detail.canonicalUrl || "")
      .split("?")[0]
      .replace(/\/+$/, "");
    const detailId = String(detail.portalJobId || "");

    for (const [key, item] of Object.entries(cache)) {
      if (!item || item.portal !== detail.portal) continue;

      const sameId =
        detailId &&
        item.portalJobId &&
        String(item.portalJobId) === detailId;

      const itemUrl = String(item.canonicalUrl || "")
        .split("?")[0]
        .replace(/\/+$/, "");

      const sameUrl =
        detailUrl &&
        itemUrl &&
        itemUrl.toLowerCase() === detailUrl.toLowerCase();

      if (sameId || sameUrl) {
        cacheKey = key;
        break;
      }
    }
  }

  const evaluatedAt =
    deepMatch?.evaluatedAt || new Date().toISOString();

  if (cache[cacheKey]) {
    cache[cacheKey] = {
      ...cache[cacheKey],
      deepMatch: deepMatch || null,
      deepMatchedAt: evaluatedAt
    };
  }

  if (detail) {
    capture.detail = {
      ...detail,
      deepMatch: deepMatch || null,
      deepMatchedAt: evaluatedAt
    };
  }

  await chrome.storage.local.set({
    [JOB_CACHE_KEY]: cache,
    [PORTAL_CAPTURE_KEY]: capture
  });

  return capture.detail || cache[cacheKey] || null;
}
