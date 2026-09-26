(() => {
  const engine = globalThis.JobPilotPortalEngine;
  if (!engine || globalThis.__JOBPILOT_INDEED_ADAPTER__) return;
  globalThis.__JOBPILOT_INDEED_ADAPTER__ = true;

  const listing = globalThis.JobPilotIndeedListing;
  const detail = globalThis.JobPilotIndeedDetail;

  engine.registerAdapter({
    id: "indeed",
    displayName: "Indeed",
    version: "2",
    matches(url) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return host === "indeed.com" || host.endsWith(".indeed.com");
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