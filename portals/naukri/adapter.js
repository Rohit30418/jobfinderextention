(() => {
  const engine = globalThis.JobPilotPortalEngine;
  if (!engine || globalThis.__JOBPILOT_NAUKRI_ADAPTER__) return;

  globalThis.__JOBPILOT_NAUKRI_ADAPTER__ = true;

  const listing = globalThis.JobPilotNaukriListing;
  const detail = globalThis.JobPilotNaukriDetail;

  engine.registerAdapter({
    id: "naukri",
    displayName: "Naukri",
    version: "1",

    matches(url) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return host === "naukri.com" || host.endsWith(".naukri.com");
      } catch (_) {
        return false;
      }
    },

    detectPage() {
      if (detail?.detect()) return "detail";
      if (listing?.detect()) return "listing";
      return "unknown";
    },

    captureListing() {
      return listing?.capture() || {
        detected: 0,
        method: "unavailable",
        jobs: []
      };
    },

    captureDetail() {
      return detail?.capture() || {
        method: "unavailable",
        job: null
      };
    }
  });
})();
