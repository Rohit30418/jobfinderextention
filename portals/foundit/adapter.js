(() => {
  const engine = globalThis.JobPilotPortalEngine;
  if (!engine || globalThis.__JOBPILOT_FOUNDIT_ADAPTER__) return;
  globalThis.__JOBPILOT_FOUNDIT_ADAPTER__ = true;

  const listing = globalThis.JobPilotFounditListing;
  const detail = globalThis.JobPilotFounditDetail;

  engine.registerAdapter({
    id: "foundit",
    displayName: "Foundit",
    version: "2",
    matches(url) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return host === "foundit.in" || host.endsWith(".foundit.in");
      } catch (_) { return false; }
    },
    detectPage() {
      if (detail?.detect()) return "detail";
      if (listing?.detect()) return "listing";
      return "unknown";
    },
    captureListing() { return listing?.capture() || { detected: 0, method: "unavailable", jobs: [] }; },
    captureDetail() { return detail?.capture() || { method: "unavailable", job: null }; }
  });
})();