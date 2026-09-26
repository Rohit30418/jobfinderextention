export const STATE_KEY = "jobpilot.stage1.state";
export const PUTER_TOKEN_KEY = "jobpilot.puter.token";
export const PUTER_AI_AUTH_KEY = "jobpilot.puter.ai.authorized";
export const PREFERENCES_KEY = "jobpilot.stage2.preferences";
export const NAUKRI_SEARCH_KEY = "jobpilot.stage3.naukriSearch";
export const NAUKRI_NATIVE_FILTERS_KEY = "jobpilot.stage3.naukriNativeFilters";

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
