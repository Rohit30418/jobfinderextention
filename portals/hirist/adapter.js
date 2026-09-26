(() => {
  const engine = globalThis.JobPilotPortalEngine;
  if (!engine || globalThis.__JOBPILOT_HIRIST_ADAPTER__) return;
  globalThis.__JOBPILOT_HIRIST_ADAPTER__ = true;

  const listing = globalThis.JobPilotHiristListing;
  const detail = globalThis.JobPilotHiristDetail;

  engine.registerAdapter({
    id: "hirist",
    displayName: "Hirist",
    version: "2",
    matches(url) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return host === "hirist.tech" || host.endsWith(".hirist.tech");
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