(() => {
  const engine = globalThis.JobPilotPortalEngine;
  if (!engine || globalThis.__JOBPILOT_LINKEDIN_ADAPTER__) return;
  globalThis.__JOBPILOT_LINKEDIN_ADAPTER__ = true;

  const listing = globalThis.JobPilotLinkedInListing;
  const detail = globalThis.JobPilotLinkedInDetail;

  engine.registerAdapter({
    id: "linkedin",
    displayName: "LinkedIn Jobs",
    version: "2",
    matches(url) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return host === "linkedin.com" || host.endsWith(".linkedin.com");
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