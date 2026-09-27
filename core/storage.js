import { analysisRevision } from "./analysis-inputs.js";
import "./portal-engine.js";
import { validateBackup } from "./backup-validator.js";
export const STATE_KEY = "jobpilot.stage1.state";
export const PUTER_TOKEN_KEY = "jobpilot.puter.token";
export const PUTER_AI_AUTH_KEY = "jobpilot.puter.ai.authorized";
export const PREFERENCES_KEY = "jobpilot.stage2.preferences";
export const NAUKRI_SEARCH_KEY = "jobpilot.stage3.naukriSearch";
export const UNIVERSAL_SEARCH_KEY = "jobpilot.stage3.universalSearch";
export const NAUKRI_NATIVE_FILTERS_KEY = "jobpilot.stage3.naukriNativeFilters";
export const NAUKRI_EXTRACTION_KEY = "jobpilot.stage4.naukriExtraction";
export const PORTAL_CAPTURE_KEY = "jobpilot.stage4.portalCapture";
export const JOB_CACHE_KEY = "jobpilot.jobs.cache";
export const LISTING_CONTEXT_KEY = "jobpilot.stage6.listingContext";
export const LISTING_CONTEXTS_KEY = "jobpilot.stage6.listingContexts";
export const GAP_HISTORY_KEY = "jobpilot.insights.gapHistory";
export const SKILL_VAULT_KEY = "jobpilot.skills.vault";
export const APPLIED_JOBS_KEY = "jobpilot.jobs.applied";

export function emptyState() {
  return {
    version: 1,
    resume: null,
    profile: null,
    updatedAt: null
  };
}

async function _getState() {
  const result = await chrome.storage.local.get(STATE_KEY);
  return result[STATE_KEY] || emptyState();
}

async function _setState(state) {
  const next = {
    ...emptyState(),
    ...state,
    version: 1,
    updatedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [STATE_KEY]: next });
  await invalidateMatches();
  return next;
}

async function _clearState() {
  await chrome.storage.local.remove([STATE_KEY, "jobpilot.backup.beforeImport"]);
  await invalidateMatches();
}

async function _getPuterToken() {
  const result = await chrome.storage.session.get(PUTER_TOKEN_KEY);
  return result[PUTER_TOKEN_KEY] || "";
}

async function _setPuterToken(token) {
  await chrome.storage.session.set({ [PUTER_TOKEN_KEY]: token || "" });
}

async function _clearPuterToken() {
  await chrome.storage.session.remove([PUTER_TOKEN_KEY, PUTER_AI_AUTH_KEY]);
}

async function _getAiAuthorized() {
  const result = await chrome.storage.session.get(PUTER_AI_AUTH_KEY);
  return result[PUTER_AI_AUTH_KEY] === true;
}

async function _setAiAuthorized(value) {
  await chrome.storage.session.set({ [PUTER_AI_AUTH_KEY]: value === true });
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

async function _getPreferences() {
  const result = await chrome.storage.local.get(PREFERENCES_KEY);
  return result[PREFERENCES_KEY] || emptyPreferences();
}

async function _setPreferences(preferences) {
  const next = {
    ...emptyPreferences(),
    ...preferences,
    version: 1,
    updatedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [PREFERENCES_KEY]: next });
  await invalidateMatches();
  return next;
}

async function _clearPreferences() {
  await chrome.storage.local.remove(PREFERENCES_KEY);
  await invalidateMatches();
}


export function emptyUniversalSearch() {
  return {
    version: 1,
    primaryRole: "",
    searchTerms: [],
    locations: [],
    experienceMin: null,
    experienceMax: null,
    freshness: "3d",
    selectedPortals: [
      "naukri",
      "foundit",
      "linkedin",
      "indeed",
      "hirist"
    ],
    urls: {},
    updatedAt: null
  };
}

async function _getUniversalSearch() {
  const result = await chrome.storage.local.get(UNIVERSAL_SEARCH_KEY);
  return result[UNIVERSAL_SEARCH_KEY] || emptyUniversalSearch();
}

async function _setUniversalSearch(search) {
  const next = {
    ...emptyUniversalSearch(),
    ...search,
    version: 1,
    updatedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({
    [UNIVERSAL_SEARCH_KEY]: next
  });

  return next;
}

async function _clearUniversalSearch() {
  await chrome.storage.local.remove(UNIVERSAL_SEARCH_KEY);
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

async function _getNaukriSearch() {
  const result = await chrome.storage.local.get(NAUKRI_SEARCH_KEY);
  return result[NAUKRI_SEARCH_KEY] || emptyNaukriSearch();
}

async function _setNaukriSearch(search) {
  const next = {
    ...emptyNaukriSearch(),
    ...search,
    version: 1,
    createdAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [NAUKRI_SEARCH_KEY]: next });
  return next;
}

async function _clearNaukriSearch() {
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

async function _getNaukriNativeFilters() {
  const result = await chrome.storage.local.get(NAUKRI_NATIVE_FILTERS_KEY);
  return result[NAUKRI_NATIVE_FILTERS_KEY] || emptyNaukriNativeFilters();
}

async function _setNaukriNativeFilters(filters) {
  const next = {
    ...emptyNaukriNativeFilters(),
    ...filters,
    version: 1,
    learnedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [NAUKRI_NATIVE_FILTERS_KEY]: next });
  return next;
}

async function _clearNaukriNativeFilters() {
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

async function _getNaukriExtraction() {
  const result = await chrome.storage.local.get(NAUKRI_EXTRACTION_KEY);
  return result[NAUKRI_EXTRACTION_KEY] || emptyNaukriExtraction();
}

async function _setNaukriExtraction(extraction) {
  const next = {
    ...emptyNaukriExtraction(),
    ...extraction,
    version: 1,
    extractedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [NAUKRI_EXTRACTION_KEY]: next });
  return next;
}

async function _clearNaukriExtraction() {
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

async function _getPortalCapture() {
  const result = await chrome.storage.local.get(PORTAL_CAPTURE_KEY);
  return result[PORTAL_CAPTURE_KEY] || emptyPortalCapture();
}

async function _setPortalCapture(capture) {
  const next = {
    ...emptyPortalCapture(),
    ...capture,
    version: 2,
    capturedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [PORTAL_CAPTURE_KEY]: next });
  return next;
}

async function _clearPortalCapture() {
  await chrome.storage.local.remove(PORTAL_CAPTURE_KEY);
}

async function _getJobCache() {
  const result = await chrome.storage.local.get(JOB_CACHE_KEY);
  const value = result[JOB_CACHE_KEY];
  const cache = value && typeof value === "object" ? value : {};
  const state = await _getState();
  const preferences = await _getPreferences();
  for (const job of Object.values(cache)) {
    const revision = analysisRevision(state.profile, preferences, job);
    for (const field of ["aiAnalysis", "aiRanking", "deepMatch"]) {
      if (job?.[field]?.inputRevision !== revision) delete job[field];
    }
  }
  return cache;
}

async function _clearJobCache() {
  await chrome.storage.local.remove(JOB_CACHE_KEY);
}


function sameStoredJob(a, b) { return globalThis.JobPilotPortalEngine.sameJob(a, b); }

async function _saveJobAiAnalysis(jobKey, analysis) {
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

  if (!cache[cacheKey] && detail?.key === requestedKey) {
    cache[cacheKey] = detail;
  }

  if (analysis?.inputRevision) {
    const state = await _getState();
    const preferences = await _getPreferences();
    const target = cache[cacheKey];
    if (!target || analysis.inputRevision !== analysisRevision(state.profile, preferences, target)) return null;
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

  const cachedTarget = cache[cacheKey] || null;

  if (
    detail &&
    (
      detail.key === requestedKey ||
      detail.key === cacheKey ||
      sameStoredJob(detail, cachedTarget)
    )
  ) {
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

  return cache[cacheKey] || (detail?.key === requestedKey ? capture.detail : null);
}


async function _saveJobDeepMatch(jobKey, deepMatch) {
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

  if (!cache[cacheKey] && detail?.key === requestedKey) {
    cache[cacheKey] = detail;
  }

  if (deepMatch?.inputRevision) {
    const state = await _getState();
    const preferences = await _getPreferences();
    const target = cache[cacheKey];
    if (!target || deepMatch.inputRevision !== analysisRevision(state.profile, preferences, target)) return null;
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

  const cachedTarget = cache[cacheKey] || null;

  if (
    detail &&
    (
      detail.key === requestedKey ||
      detail.key === cacheKey ||
      sameStoredJob(detail, cachedTarget)
    )
  ) {
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

  const gapJob =
    cache[cacheKey] ||
    (
      detail && sameStoredJob(detail, cachedTarget)
        ? detail
        : null
    );

  if (gapJob && deepMatch) {
    await _saveGapSnapshot(
      cacheKey || requestedKey,
      gapJob,
      deepMatch
    );

    await _saveMissingSkillsToVault(
      cacheKey || requestedKey,
      gapJob,
      deepMatch
    );
  }

  return cache[cacheKey] || (detail?.key === requestedKey ? capture.detail : null);
}


export function emptyListingContext() {
  return {
    version: 1,
    portal: "",
    portalName: "",
    sourceUrl: "",
    jobs: [],
    relevanceStats: {
      relevant: 0,
      review: 0,
      filtered: 0
    },
    capturedAt: null
  };
}

export function emptyListingContexts() {
  return {
    version: 1,
    portals: {},
    updatedAt: null
  };
}

async function _getListingContext() {
  const result = await chrome.storage.local.get(LISTING_CONTEXT_KEY);
  return result[LISTING_CONTEXT_KEY] || emptyListingContext();
}

async function _getListingContexts() {
  const result = await chrome.storage.local.get(LISTING_CONTEXTS_KEY);
  const value = result[LISTING_CONTEXTS_KEY];

  return value && typeof value === "object"
    ? {
        ...emptyListingContexts(),
        ...value,
        portals:
          value.portals && typeof value.portals === "object"
            ? value.portals
            : {}
      }
    : emptyListingContexts();
}

async function _setListingContext(context) {
  const next = {
    ...emptyListingContext(),
    ...context,
    version: 1,
    capturedAt: new Date().toISOString()
  };

  const contexts = await _getListingContexts();
  const portalKey = String(next.portal || "unknown").trim() || "unknown";

  const nextContexts = {
    ...contexts,
    version: 1,
    portals: {
      ...contexts.portals,
      [portalKey]: next
    },
    updatedAt: next.capturedAt
  };

  await chrome.storage.local.set({
    [LISTING_CONTEXT_KEY]: next,
    [LISTING_CONTEXTS_KEY]: nextContexts
  });

  return next;
}

async function _clearListingContext() {
  await chrome.storage.local.remove([
    LISTING_CONTEXT_KEY,
    LISTING_CONTEXTS_KEY
  ]);
}

function normalizeGapValue(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueGapValues(values) {
  const output = [];
  const seen = new Set();

  for (const item of values || []) {
    const value = normalizeGapValue(item);
    const key = value.toLowerCase();

    if (!value || seen.has(key)) continue;

    seen.add(key);
    output.push(value);
  }

  return output;
}

function gapRecordKey(jobKey, job) {
  if (jobKey) return String(jobKey);

  if (job?.portalJobId) {
    return String(job.portal || "portal") + ":" + String(job.portalJobId);
  }

  return String(job?.canonicalUrl || job?.title || Date.now());
}

async function _saveGapSnapshot(jobKey, job, deepMatch) {
  if (!deepMatch || !job) return null;

  const result = await chrome.storage.local.get(GAP_HISTORY_KEY);
  const history =
    result[GAP_HISTORY_KEY] &&
    typeof result[GAP_HISTORY_KEY] === "object"
      ? result[GAP_HISTORY_KEY]
      : {};

  const key = gapRecordKey(jobKey, job);
  const now = new Date().toISOString();
  const previous = history[key] || null;

  history[key] = {
    key,
    portal: job.portal || deepMatch.portal || "",
    title: job.title || "",
    company: job.company || "",
    canonicalUrl: job.canonicalUrl || "",
    roleFamily: deepMatch.source?.roleFamily || "",
    matchScore: Number.isFinite(deepMatch.matchScore?.score)
      ? deepMatch.matchScore.score
      : null,
    decision: deepMatch.applyDecision?.action || "",
    verdict: deepMatch.verdict || "",

    missingRequired: uniqueGapValues(
      deepMatch.skills?.required?.missing || []
    ),

    missingPreferred: uniqueGapValues(
      deepMatch.skills?.preferred?.missing || []
    ),

    blockers: uniqueGapValues(
      (deepMatch.blockers || []).map((item) =>
        item?.detail
          ? item.label + ": " + item.detail
          : item?.label
      )
    ),

    gaps: uniqueGapValues(
      (deepMatch.gaps || []).map((item) =>
        item?.detail
          ? item.label + ": " + item.detail
          : item?.label
      )
    ),

    firstSeenAt: previous?.firstSeenAt || now,
    lastSeenAt: now
  };

  const compact = Object.fromEntries(
    Object.entries(history)
      .sort((a, b) =>
        String(b[1]?.lastSeenAt || "").localeCompare(
          String(a[1]?.lastSeenAt || "")
        )
      )
      .slice(0, 500)
  );

  await chrome.storage.local.set({
    [GAP_HISTORY_KEY]: compact
  });

  return compact[key] || history[key];
}

async function _getGapHistory() {
  const result = await chrome.storage.local.get(GAP_HISTORY_KEY);
  const value = result[GAP_HISTORY_KEY];
  return value && typeof value === "object" ? value : {};
}

async function _getGapInsights(days = 7) {
  const rangeDays = Math.max(1, Number(days) || 7);

  const [history, cache] = await Promise.all([
    _getGapHistory(),
    _getJobCache()
  ]);

  const cutoff =
    Date.now() - rangeDays * 24 * 60 * 60 * 1000;

  const recordMap = new Map(
    Object.entries(history).map(([key, value]) => [
      key,
      value
    ])
  );

  for (const [key, job] of Object.entries(cache)) {
    if (!job?.deepMatch || recordMap.has(key)) continue;

    const seenAt =
      job.deepMatchedAt ||
      job.deepMatch.evaluatedAt ||
      null;

    const time = Date.parse(seenAt || "");

    if (!Number.isFinite(time) || time < cutoff) {
      continue;
    }

    recordMap.set(key, {
      key,
      portal: job.portal || job.deepMatch.portal || "",
      title: job.title || "",
      company: job.company || "",
      canonicalUrl: job.canonicalUrl || "",
      roleFamily: job.deepMatch.source?.roleFamily || "",
      matchScore: Number.isFinite(job.deepMatch.matchScore?.score)
        ? job.deepMatch.matchScore.score
        : null,
      decision: job.deepMatch.applyDecision?.action || "",
      verdict: job.deepMatch.verdict || "",

      missingRequired: uniqueGapValues(
        job.deepMatch.skills?.required?.missing || []
      ),

      missingPreferred: uniqueGapValues(
        job.deepMatch.skills?.preferred?.missing || []
      ),

      blockers: uniqueGapValues(
        (job.deepMatch.blockers || []).map((item) =>
          item?.detail
            ? item.label + ": " + item.detail
            : item?.label
        )
      ),

      gaps: uniqueGapValues(
        (job.deepMatch.gaps || []).map((item) =>
          item?.detail
            ? item.label + ": " + item.detail
            : item?.label
        )
      ),

      firstSeenAt: seenAt,
      lastSeenAt: seenAt
    });
  }

  const records = [...recordMap.values()].filter((item) => {
    const time = Date.parse(item?.lastSeenAt || "");
    return Number.isFinite(time) && time >= cutoff;
  });

  const countValues = (field) => {
    const map = new Map();

    for (const record of records) {
      for (const raw of record?.[field] || []) {
        const value = normalizeGapValue(raw);
        const key = value.toLowerCase();

        if (!value) continue;

        const existing = map.get(key) || {
          value,
          count: 0,
          portals: new Set()
        };

        existing.count += 1;

        if (record.portal) {
          existing.portals.add(record.portal);
        }

        map.set(key, existing);
      }
    }

    return [...map.values()]
      .map((item) => ({
        value: item.value,
        count: item.count,
        portals: [...item.portals]
      }))
      .sort((a, b) =>
        b.count - a.count ||
        a.value.localeCompare(b.value)
      );
  };

  const portalCounts = {};

  for (const record of records) {
    const portal = record.portal || "unknown";
    portalCounts[portal] = (portalCounts[portal] || 0) + 1;
  }

  return {
    days: rangeDays,
    analyzedJobs: records.length,
    missingRequired: countValues("missingRequired"),
    missingPreferred: countValues("missingPreferred"),
    blockers: countValues("blockers"),
    portalCounts,
    generatedAt: new Date().toISOString()
  };
}

async function _clearGapHistory() {
  await chrome.storage.local.remove(GAP_HISTORY_KEY);
}


async function _saveJobAiRankings(rankings) {
  const rows = Array.isArray(rankings) ? rankings : [];
  const result = await chrome.storage.local.get(JOB_CACHE_KEY);
  const cache =
    result[JOB_CACHE_KEY] && typeof result[JOB_CACHE_KEY] === "object"
      ? result[JOB_CACHE_KEY]
      : {};

  for (const row of rows) {
    const key = String(row?.key || "").trim();
    if (!key || !cache[key]) continue;
    const state = await _getState();
    const preferences = await _getPreferences();
    if (row.inputRevision !== analysisRevision(state.profile, preferences, cache[key])) continue;

    cache[key] = {
      ...cache[key],
      aiRanking: row,
      aiRankedAt: row?.analyzedAt || new Date().toISOString()
    };
  }

  await chrome.storage.local.set({ [JOB_CACHE_KEY]: cache });
  return cache;
}


export function emptySkillVault() {
  return {
    version: 1,
    items: {},
    updatedAt: null
  };
}

function skillVaultKey(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function compactSkillVault(vault) {
  const source = vault && typeof vault === "object"
    ? vault
    : emptySkillVault();

  const items = Object.values(source.items || {})
    .filter((item) => item?.skill)
    .sort((a, b) =>
      String(b.lastSeenAt || "").localeCompare(
        String(a.lastSeenAt || "")
      )
    )
    .slice(0, 200);

  return {
    version: 1,
    items: Object.fromEntries(
      items.map((item) => [
        skillVaultKey(item.skill),
        {
          skill: item.skill,
          status: item.status || "missing",
          kind: item.kind || "required",
          sourceKeys: Array.isArray(item.sourceKeys)
            ? item.sourceKeys.slice(0, 40)
            : [],
          portals: Array.isArray(item.portals)
            ? item.portals.slice(0, 10)
            : [],
          firstSeenAt: item.firstSeenAt || null,
          lastSeenAt: item.lastSeenAt || null,
          addedAt: item.addedAt || null,
          dismissedAt: item.dismissedAt || null,
          removedAt: item.removedAt || null,
          manual: item.manual === true
        }
      ])
    ),
    updatedAt: source.updatedAt || new Date().toISOString()
  };
}

async function persistSkillVault(vault) {
  const compact = compactSkillVault({
    ...vault,
    updatedAt: new Date().toISOString()
  });

  await chrome.storage.local.set({
    [SKILL_VAULT_KEY]: compact
  });

  // A compact portable mirror fits Chrome's per-item quota; full evidence stays local.
  const mirror = { version: 2, items: Object.values(compact.items).map(item => [item.skill.slice(0, 100), item.status, item.kind]) };
  compact.syncStatus = "local-only";
  try {
    if (new TextEncoder().encode(JSON.stringify(mirror)).length > 7800) throw new Error("Sync copy is too large; export a backup to transfer all skills.");
    await chrome.storage.sync.set({ [SKILL_VAULT_KEY]: mirror });
    compact.syncStatus = "synced";
  } catch (error) {
    compact.syncError = error?.message || "Chrome Sync is unavailable.";
  }
  await chrome.storage.local.set({ [SKILL_VAULT_KEY]: compact });

  return compact;
}

async function _getSkillVault() {
  const localResult = await chrome.storage.local.get(SKILL_VAULT_KEY);
  const localValue = localResult[SKILL_VAULT_KEY];

  if (
    localValue &&
    typeof localValue === "object" &&
    localValue.items && typeof localValue.items === "object"
  ) {
    return {
      ...emptySkillVault(),
      ...localValue,
      items: localValue.items || {}
    };
  }

  try {
    const syncResult = await chrome.storage.sync.get(SKILL_VAULT_KEY);
    const syncValue = syncResult[SKILL_VAULT_KEY];

    if (syncValue && typeof syncValue === "object") {
      const restored = {
        ...emptySkillVault(),
        ...syncValue,
        items: syncValue.version === 2 && Array.isArray(syncValue.items)
          ? Object.fromEntries(syncValue.items.map(([skill, status, kind]) => [skillVaultKey(skill), { skill, status, kind, sourceKeys: [], portals: [] }]))
          : syncValue.items || {}
      };

      await chrome.storage.local.set({
        [SKILL_VAULT_KEY]: restored
      });

      return restored;
    }
  } catch (_) {}

  return emptySkillVault();
}

async function _saveMissingSkillsToVault(jobKey, job, deepMatch) {
  if (!deepMatch) return null;

  const vault = await _getSkillVault();
  const now = new Date().toISOString();
  const portal = String(job?.portal || deepMatch?.portal || "");
  const sourceKey = String(
    jobKey ||
    job?.key ||
    job?.portalJobId ||
    job?.canonicalUrl ||
    ""
  );

  const required = uniqueGapValues(
    deepMatch.skills?.required?.missing || []
  );

  const preferred = uniqueGapValues(
    deepMatch.skills?.preferred?.missing || []
  );

  const upsert = (skill, kind) => {
    const key = skillVaultKey(skill);
    if (!key) return;

    const previous = vault.items[key] || null;

    const sourceKeys = uniqueGapValues([
      ...(previous?.sourceKeys || []),
      sourceKey
    ]).filter(Boolean);

    const portals = uniqueGapValues([
      ...(previous?.portals || []),
      portal
    ]).filter(Boolean);

    vault.items[key] = {
      skill,
      status:
        previous?.status === "added" ||
        previous?.status === "dismissed"
          ? previous.status
          : "missing",
      kind:
        previous?.kind === "required" || kind === "required"
          ? "required"
          : "preferred",
      sourceKeys,
      portals,
      firstSeenAt: previous?.firstSeenAt || now,
      lastSeenAt: now,
      addedAt: previous?.addedAt || null,
      dismissedAt: previous?.dismissedAt || null,
      removedAt: previous?.removedAt || null,
      manual: previous?.manual === true
    };
  };

  required.forEach((skill) => upsert(skill, "required"));
  preferred.forEach((skill) => upsert(skill, "preferred"));

  return persistSkillVault(vault);
}

async function _addSkillToProfile(skill) {
  const value = String(skill || "").trim().replace(/\s+/g, " ");
  if (!value) throw new Error("Skill is required.");

  const [state, vault] = await Promise.all([
    _getState(),
    _getSkillVault()
  ]);

  if (!state?.profile) {
    throw new Error("Save your profile first.");
  }

  const skills = uniqueGapValues([
    ...(state.profile.skills || []),
    value
  ]);

  const nextState = {
    ...state,
    profile: {
      ...state.profile,
      skills
    }
  };

  await _setState(nextState);

  const key = skillVaultKey(value);
  const previous = vault.items[key] || {};
  const now = new Date().toISOString();

  vault.items[key] = {
    skill: value,
    status: "added",
    kind: previous.kind || "required",
    sourceKeys: previous.sourceKeys || [],
    portals: previous.portals || [],
    firstSeenAt: previous.firstSeenAt || now,
    lastSeenAt: previous.lastSeenAt || now,
    addedAt: now,
    dismissedAt: null,
    removedAt: previous.removedAt || null,
    manual: true
  };

  await persistSkillVault(vault);
  return nextState.profile;
}

async function _removeSkillFromProfile(skill) {
  const value = String(skill || "").trim().replace(/\s+/g, " ");
  if (!value) throw new Error("Skill is required.");

  const [state, vault] = await Promise.all([
    _getState(),
    _getSkillVault()
  ]);

  if (!state?.profile) {
    throw new Error("Save your profile first.");
  }

  const key = skillVaultKey(value);

  const skills = (state.profile.skills || []).filter(
    (item) => skillVaultKey(item) !== key
  );

  const nextState = {
    ...state,
    profile: {
      ...state.profile,
      skills
    }
  };

  await _setState(nextState);

  const previous = vault.items[key] || {};
  const now = new Date().toISOString();

  vault.items[key] = {
    skill: previous.skill || value,
    status:
      Array.isArray(previous.sourceKeys) && previous.sourceKeys.length
        ? "missing"
        : "dismissed",
    kind: previous.kind || "required",
    sourceKeys: previous.sourceKeys || [],
    portals: previous.portals || [],
    firstSeenAt: previous.firstSeenAt || now,
    lastSeenAt: previous.lastSeenAt || now,
    addedAt: previous.addedAt || null,
    dismissedAt:
      Array.isArray(previous.sourceKeys) && previous.sourceKeys.length
        ? null
        : now,
    removedAt: now,
    manual: previous.manual === true
  };

  await persistSkillVault(vault);
  return nextState.profile;
}

async function _dismissSkillFromVault(skill) {
  const value = String(skill || "").trim().replace(/\s+/g, " ");
  const key = skillVaultKey(value);
  if (!key) throw new Error("Skill is required.");

  const vault = await _getSkillVault();
  const previous = vault.items[key] || {};
  const now = new Date().toISOString();

  vault.items[key] = {
    skill: previous.skill || value,
    status: "dismissed",
    kind: previous.kind || "required",
    sourceKeys: previous.sourceKeys || [],
    portals: previous.portals || [],
    firstSeenAt: previous.firstSeenAt || now,
    lastSeenAt: previous.lastSeenAt || now,
    addedAt: previous.addedAt || null,
    dismissedAt: now,
    removedAt: previous.removedAt || null,
    manual: previous.manual === true
  };

  return persistSkillVault(vault);
}

async function _restoreSkillInVault(skill) {
  const value = String(skill || "").trim().replace(/\s+/g, " ");
  const key = skillVaultKey(value);
  if (!key) throw new Error("Skill is required.");

  const vault = await _getSkillVault();
  const previous = vault.items[key] || {};
  const now = new Date().toISOString();

  vault.items[key] = {
    skill: previous.skill || value,
    status: "missing",
    kind: previous.kind || "required",
    sourceKeys: previous.sourceKeys || [],
    portals: previous.portals || [],
    firstSeenAt: previous.firstSeenAt || now,
    lastSeenAt: previous.lastSeenAt || now,
    addedAt: previous.addedAt || null,
    dismissedAt: null,
    removedAt: previous.removedAt || null,
    manual: previous.manual === true
  };

  return persistSkillVault(vault);
}


const JOBPILOT_BACKUP_KEYS = [
  STATE_KEY,
  PREFERENCES_KEY,
  NAUKRI_SEARCH_KEY,
  UNIVERSAL_SEARCH_KEY,
  NAUKRI_NATIVE_FILTERS_KEY,
  PORTAL_CAPTURE_KEY,
  JOB_CACHE_KEY,
  LISTING_CONTEXT_KEY,
  LISTING_CONTEXTS_KEY,
  GAP_HISTORY_KEY,
  SKILL_VAULT_KEY,
  APPLIED_JOBS_KEY
];

async function _exportJobPilotBackup() {
  const data = await chrome.storage.local.get(JOBPILOT_BACKUP_KEYS);

  return {
    type: "jobpilot-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  };
}

async function _importJobPilotBackup(payload) {
  if (
    !payload ||
    payload.type !== "jobpilot-backup" ||
    !payload.data ||
    typeof payload.data !== "object"
  ) {
    throw new Error("This is not a valid JobPilot backup.");
  }

  validateBackup(payload);
  const allowed = {};
  for (const key of JOBPILOT_BACKUP_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload.data, key)) {
      allowed[key] = payload.data[key];
    }
  }

  if (!Object.keys(allowed).length) {
    throw new Error("The backup does not contain restorable JobPilot data.");
  }

  const previous = await chrome.storage.local.get(JOBPILOT_BACKUP_KEYS);
  await chrome.storage.local.set({ "jobpilot.backup.beforeImport": previous });
  await chrome.storage.local.set(allowed);
  await invalidateMatches();

  if (allowed[SKILL_VAULT_KEY]) await persistSkillVault(allowed[SKILL_VAULT_KEY]);

  return true;
}


export function emptyAppliedJobs() {
  return {
    version: 1,
    items: {},
    updatedAt: null
  };
}

function appliedJobKey(job) {
  if (job?.key) return String(job.key);

  if (job?.portal && job?.portalJobId) {
    return String(job.portal) + ":" + String(job.portalJobId);
  }

  const url = String(job?.canonicalUrl || "")
    .split("#")[0]
    .replace(/\/+$/, "")
    .toLowerCase();

  if (url) return url;

  return [
    String(job?.portal || ""),
    String(job?.company || ""),
    String(job?.title || "")
  ].join("::").toLowerCase();
}

async function _getAppliedJobs() {
  const result = await chrome.storage.local.get(APPLIED_JOBS_KEY);
  const value = result[APPLIED_JOBS_KEY];

  return value && typeof value === "object"
    ? {
        ...emptyAppliedJobs(),
        ...value,
        items:
          value.items && typeof value.items === "object"
            ? value.items
            : {}
      }
    : emptyAppliedJobs();
}

async function _markJobApplied(job, options = {}) {
  if (!job) {
    throw new Error("Job data is required.");
  }

  const store = await _getAppliedJobs();
  const key = appliedJobKey(job);
  const now = new Date().toISOString();
  const previous = store.items[key] || null;

  const deepScore = Number.isFinite(job?.deepMatch?.matchScore?.score)
    ? job.deepMatch.matchScore.score
    : null;

  const aiScore = Number.isFinite(job?.aiRanking?.fitScore)
    ? job.aiRanking.fitScore
    : null;

  store.items[key] = {
    key,
    portal: String(job.portal || ""),
    portalName: String(job.portalName || job.portal || ""),
    portalJobId: String(job.portalJobId || ""),
    title: String(job.title || ""),
    company: String(job.company || ""),
    canonicalUrl: String(job.canonicalUrl || ""),
    location: String(job.location || ""),
    experienceText: String(job.experienceText || ""),
    salaryText: String(job.salaryText || ""),
    postedAge: String(job.postedAge || ""),
    skills: uniqueGapValues(job.skills || []).slice(0, 40),

    matchScore: deepScore,
    aiFitScore: aiScore,
    decision:
      String(
        job?.deepMatch?.applyDecision?.action ||
        job?.aiRanking?.decision ||
        ""
      ),
    verdict: String(job?.deepMatch?.verdict || ""),
    roleFamily: String(
      job?.deepMatch?.source?.roleFamily ||
      job?.aiAnalysis?.roleFamily ||
      job?.aiRanking?.roleFamily ||
      ""
    ),

    status: "applied",
    applicationSource: String(options.source || previous?.applicationSource || ""),
    appliedAt: previous?.appliedAt || now,
    updatedAt: now,
    note: String(options.note || previous?.note || "")
  };

  store.updatedAt = now;

  await chrome.storage.local.set({
    [APPLIED_JOBS_KEY]: store
  });

  return store.items[key];
}

async function _unmarkJobApplied(jobOrKey) {
  const store = await _getAppliedJobs();

  const key =
    typeof jobOrKey === "string"
      ? jobOrKey
      : appliedJobKey(jobOrKey);

  if (!key || !store.items[key]) {
    return false;
  }

  delete store.items[key];
  store.updatedAt = new Date().toISOString();

  await chrome.storage.local.set({
    [APPLIED_JOBS_KEY]: store
  });

  return true;
}

async function _isJobApplied(job) {
  const store = await _getAppliedJobs();
  const key = appliedJobKey(job);
  return Boolean(key && store.items[key]);
}

async function _updateAppliedJobNote(jobOrKey, note) {
  const store = await _getAppliedJobs();

  const key =
    typeof jobOrKey === "string"
      ? jobOrKey
      : appliedJobKey(jobOrKey);

  if (!key || !store.items[key]) {
    throw new Error("Applied job was not found.");
  }

  store.items[key] = {
    ...store.items[key],
    note: String(note || ""),
    updatedAt: new Date().toISOString()
  };

  store.updatedAt = new Date().toISOString();

  await chrome.storage.local.set({
    [APPLIED_JOBS_KEY]: store
  });

  return store.items[key];
}

async function _exportAppliedJobsData() {
  const store = await _getAppliedJobs();

  return Object.values(store.items || {})
    .filter((item) => item?.status === "applied")
    .sort((a, b) =>
      String(b.appliedAt || "").localeCompare(
        String(a.appliedAt || "")
      )
    );
}

async function invalidateMatches() {
  const result = await chrome.storage.local.get([JOB_CACHE_KEY, PORTAL_CAPTURE_KEY, LISTING_CONTEXTS_KEY, LISTING_CONTEXT_KEY]);
  const clear = job => {
    if (!job) return;
    for (const key of ["aiAnalysis", "aiRanking", "deepMatch", "aiAnalyzedAt", "aiRankedAt", "deepMatchedAt"]) delete job[key];
  };
  Object.values(result[JOB_CACHE_KEY] || {}).forEach(clear);
  clear(result[PORTAL_CAPTURE_KEY]?.detail);
  (result[PORTAL_CAPTURE_KEY]?.jobs || []).forEach(clear);
  (result[LISTING_CONTEXT_KEY]?.jobs || []).forEach(clear);
  Object.values(result[LISTING_CONTEXTS_KEY]?.portals || {}).forEach(context => (context.jobs || []).forEach(clear));
  await chrome.storage.local.set(result);
}

async function _toggleJobApplied(job, options = {}) {
  if (await _isJobApplied(job)) {
    await _unmarkJobApplied(job);
    return { applied: false };
  }
  return { applied: true, record: await _markJobApplied(job, options) };
}

async function _persistPortalCapture(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.jobs) || data.jobs.length > 500) throw new Error("Invalid portal capture.");
  const cache = await _getJobCache();
  const engine = globalThis.JobPilotPortalEngine;
  for (const job of [...data.jobs, ...(data.detail ? [data.detail] : [])]) {
    if (!job?.key || typeof job.key !== "string" || ["__proto__", "constructor", "prototype"].includes(job.key)) continue;
    const key = Object.keys(cache).find(key => engine.sameJob(cache[key], job)) || job.key;
    cache[key] = { ...engine.mergeJob(cache[key], job), key };
    if (job === data.detail) data.detail = cache[key];
  }
  const compact = Object.fromEntries(Object.entries(cache).sort((a,b) => String(b[1]?.capturedAt || "").localeCompare(String(a[1]?.capturedAt || ""))).slice(0, 1000));
  await chrome.storage.local.set({ [JOB_CACHE_KEY]: compact });
  await _setPortalCapture(data);
  if (data.pageType === "listing") await _setListingContext(data);
  return true;
}

const operations = {
  getState: _getState,
  setState: _setState,
  clearState: _clearState,
  getPuterToken: _getPuterToken,
  setPuterToken: _setPuterToken,
  clearPuterToken: _clearPuterToken,
  getAiAuthorized: _getAiAuthorized,
  setAiAuthorized: _setAiAuthorized,
  getPreferences: _getPreferences,
  setPreferences: _setPreferences,
  clearPreferences: _clearPreferences,
  getUniversalSearch: _getUniversalSearch,
  setUniversalSearch: _setUniversalSearch,
  clearUniversalSearch: _clearUniversalSearch,
  getNaukriSearch: _getNaukriSearch,
  setNaukriSearch: _setNaukriSearch,
  clearNaukriSearch: _clearNaukriSearch,
  getNaukriNativeFilters: _getNaukriNativeFilters,
  setNaukriNativeFilters: _setNaukriNativeFilters,
  clearNaukriNativeFilters: _clearNaukriNativeFilters,
  getNaukriExtraction: _getNaukriExtraction,
  setNaukriExtraction: _setNaukriExtraction,
  clearNaukriExtraction: _clearNaukriExtraction,
  getPortalCapture: _getPortalCapture,
  setPortalCapture: _setPortalCapture,
  clearPortalCapture: _clearPortalCapture,
  getJobCache: _getJobCache,
  clearJobCache: _clearJobCache,
  saveJobAiAnalysis: _saveJobAiAnalysis,
  saveJobDeepMatch: _saveJobDeepMatch,
  getListingContext: _getListingContext,
  getListingContexts: _getListingContexts,
  setListingContext: _setListingContext,
  clearListingContext: _clearListingContext,
  saveGapSnapshot: _saveGapSnapshot,
  getGapHistory: _getGapHistory,
  getGapInsights: _getGapInsights,
  clearGapHistory: _clearGapHistory,
  saveJobAiRankings: _saveJobAiRankings,
  getSkillVault: _getSkillVault,
  saveMissingSkillsToVault: _saveMissingSkillsToVault,
  addSkillToProfile: _addSkillToProfile,
  removeSkillFromProfile: _removeSkillFromProfile,
  dismissSkillFromVault: _dismissSkillFromVault,
  restoreSkillInVault: _restoreSkillInVault,
  exportJobPilotBackup: _exportJobPilotBackup,
  importJobPilotBackup: _importJobPilotBackup,
  getAppliedJobs: _getAppliedJobs,
  markJobApplied: _markJobApplied,
  unmarkJobApplied: _unmarkJobApplied,
  isJobApplied: _isJobApplied,
  updateAppliedJobNote: _updateAppliedJobNote,
  exportAppliedJobsData: _exportAppliedJobsData,
  toggleJobApplied: _toggleJobApplied,
  persistPortalCapture: _persistPortalCapture
};
let queue = Promise.resolve();
export function runStorageOperation(name, args = []) {
  if (!Object.hasOwn(operations, name) || !Array.isArray(args)) return Promise.reject(new Error("Unknown storage operation."));
  const next = queue.then(() => {
    const execute = () => operations[name](...args);
    // One origin-wide lock coordinates extension pages AND the service worker.
    // Internal operations call raw helpers, so the lock is never nested.
    return globalThis.navigator?.locks?.request
      ? navigator.locks.request("jobpilot.storage.v1", execute)
      : execute();
  });
  queue = next.catch(() => {});
  return next;
}
async function dispatch(name, args) {
  const ownPage = typeof document !== "undefined" &&
    String(globalThis.location?.href || "").startsWith(chrome.runtime.getURL(""));
  if (typeof document === "undefined" || (ownPage && globalThis.navigator?.locks?.request)) {
    return runStorageOperation(name, args);
  }
  const response = await chrome.runtime.sendMessage({ type: "jobpilot:storage", name, args });
  if (!response?.ok) throw new Error(response?.error || "JobPilot storage is unavailable. Reload the extension.");
  return response.value;
}
export const getState = (...args) => dispatch("getState", args);
export const setState = (...args) => dispatch("setState", args);
export const clearState = (...args) => dispatch("clearState", args);
export const getPuterToken = (...args) => dispatch("getPuterToken", args);
export const setPuterToken = (...args) => dispatch("setPuterToken", args);
export const clearPuterToken = (...args) => dispatch("clearPuterToken", args);
export const getAiAuthorized = (...args) => dispatch("getAiAuthorized", args);
export const setAiAuthorized = (...args) => dispatch("setAiAuthorized", args);
export const getPreferences = (...args) => dispatch("getPreferences", args);
export const setPreferences = (...args) => dispatch("setPreferences", args);
export const clearPreferences = (...args) => dispatch("clearPreferences", args);
export const getUniversalSearch = (...args) => dispatch("getUniversalSearch", args);
export const setUniversalSearch = (...args) => dispatch("setUniversalSearch", args);
export const clearUniversalSearch = (...args) => dispatch("clearUniversalSearch", args);
export const getNaukriSearch = (...args) => dispatch("getNaukriSearch", args);
export const setNaukriSearch = (...args) => dispatch("setNaukriSearch", args);
export const clearNaukriSearch = (...args) => dispatch("clearNaukriSearch", args);
export const getNaukriNativeFilters = (...args) => dispatch("getNaukriNativeFilters", args);
export const setNaukriNativeFilters = (...args) => dispatch("setNaukriNativeFilters", args);
export const clearNaukriNativeFilters = (...args) => dispatch("clearNaukriNativeFilters", args);
export const getNaukriExtraction = (...args) => dispatch("getNaukriExtraction", args);
export const setNaukriExtraction = (...args) => dispatch("setNaukriExtraction", args);
export const clearNaukriExtraction = (...args) => dispatch("clearNaukriExtraction", args);
export const getPortalCapture = (...args) => dispatch("getPortalCapture", args);
export const setPortalCapture = (...args) => dispatch("setPortalCapture", args);
export const clearPortalCapture = (...args) => dispatch("clearPortalCapture", args);
export const getJobCache = (...args) => dispatch("getJobCache", args);
export const clearJobCache = (...args) => dispatch("clearJobCache", args);
export const saveJobAiAnalysis = (...args) => dispatch("saveJobAiAnalysis", args);
export const saveJobDeepMatch = (...args) => dispatch("saveJobDeepMatch", args);
export const getListingContext = (...args) => dispatch("getListingContext", args);
export const getListingContexts = (...args) => dispatch("getListingContexts", args);
export const setListingContext = (...args) => dispatch("setListingContext", args);
export const clearListingContext = (...args) => dispatch("clearListingContext", args);
export const saveGapSnapshot = (...args) => dispatch("saveGapSnapshot", args);
export const getGapHistory = (...args) => dispatch("getGapHistory", args);
export const getGapInsights = (...args) => dispatch("getGapInsights", args);
export const clearGapHistory = (...args) => dispatch("clearGapHistory", args);
export const saveJobAiRankings = (...args) => dispatch("saveJobAiRankings", args);
export const getSkillVault = (...args) => dispatch("getSkillVault", args);
export const saveMissingSkillsToVault = (...args) => dispatch("saveMissingSkillsToVault", args);
export const addSkillToProfile = (...args) => dispatch("addSkillToProfile", args);
export const removeSkillFromProfile = (...args) => dispatch("removeSkillFromProfile", args);
export const dismissSkillFromVault = (...args) => dispatch("dismissSkillFromVault", args);
export const restoreSkillInVault = (...args) => dispatch("restoreSkillInVault", args);
export const exportJobPilotBackup = (...args) => dispatch("exportJobPilotBackup", args);
export const importJobPilotBackup = (...args) => dispatch("importJobPilotBackup", args);
export const getAppliedJobs = (...args) => dispatch("getAppliedJobs", args);
export const markJobApplied = (...args) => dispatch("markJobApplied", args);
export const unmarkJobApplied = (...args) => dispatch("unmarkJobApplied", args);
export const isJobApplied = (...args) => dispatch("isJobApplied", args);
export const updateAppliedJobNote = (...args) => dispatch("updateAppliedJobNote", args);
export const exportAppliedJobsData = (...args) => dispatch("exportAppliedJobsData", args);
export const toggleJobApplied = (...args) => dispatch("toggleJobApplied", args);
export const persistPortalCapture = (...args) => dispatch("persistPortalCapture", args);

async function _undoLastImport() {
  const key = "jobpilot.backup.beforeImport";
  const previous = (await chrome.storage.local.get(key))[key];
  if (!previous) throw new Error("There is no previous import to undo.");
  validateBackup({ type: "jobpilot-backup", version: 1, data: previous });
  await chrome.storage.local.remove(JOBPILOT_BACKUP_KEYS.filter(name => !Object.hasOwn(previous, name)));
  await chrome.storage.local.set(previous);
  await chrome.storage.local.remove(key);
  if (previous[SKILL_VAULT_KEY]) await persistSkillVault(previous[SKILL_VAULT_KEY]);
  else await chrome.storage.sync.remove(SKILL_VAULT_KEY);
  await invalidateMatches();
  return true;
}
operations.undoLastImport = _undoLastImport;
export const undoLastImport = (...args) => dispatch("undoLastImport", args);
