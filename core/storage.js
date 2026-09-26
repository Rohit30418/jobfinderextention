export const STATE_KEY = "jobpilot.stage1.state";
export const PUTER_TOKEN_KEY = "jobpilot.puter.token";
export const PUTER_AI_AUTH_KEY = "jobpilot.puter.ai.authorized";

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
