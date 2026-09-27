import { setPuterToken, setAiAuthorized } from "./storage.js";
const PENDING = "jobpilot.auth.pending";
const BRIDGE = "https://rohit30418.github.io/jobfinderextention/puter-auth.html";
export function isExtensionPage(sender) {
  return sender?.id === chrome.runtime.id && String(sender.url || "").startsWith(chrome.runtime.getURL(""));
}
let authQueue = Promise.resolve();
export async function beginAuth(sender) {
  if (!isExtensionPage(sender)) throw new Error("Sign-in must start inside JobPilot.");
  const state = crypto.randomUUID() + "-" + crypto.randomUUID();
  await chrome.storage.session.set({ [PENDING]: { state, expires: Date.now() + 300000, completed: false } });
  return state;
}
export async function authStatus(state, sender) {
  if (!isExtensionPage(sender)) throw new Error("Unauthorized sign-in status request.");
  const pending = (await chrome.storage.session.get(PENDING))[PENDING];
  return { completed: Boolean(pending?.state === state && pending.completed), expired: !pending || pending.state !== state || pending.expires < Date.now() };
}
export function acceptBridge(message, sender) {
  const next = authQueue.then(async () => {
    let url;
    try { url = new URL(sender?.url || ""); } catch { return { ok: false }; }
    if (url.origin + url.pathname !== BRIDGE || sender.id) return { ok: false };
    const pending = (await chrome.storage.session.get(PENDING))[PENDING];
    if (!pending || pending.completed || pending.expires < Date.now() || pending.state !== message.state) return { ok: false };
    if (message.type === "jobpilot:auth-check") return { ok: true };
    if (message.type !== "jobpilot:auth-complete" || typeof message.token !== "string" || !message.token || message.token.length > 16384 || message.aiAuthorized !== true) return { ok: false };
    await setPuterToken(message.token);
    await setAiAuthorized(true);
    await chrome.storage.session.set({ [PENDING]: { ...pending, completed: true } });
    return { ok: true };
  });
  authQueue = next.catch(() => {});
  return next;
}
