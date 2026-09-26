# Stage 4 universal portal engine checklist

## Runtime

- [ ] Portal runtime detects the active portal through the registry.
- [ ] Naukri loads the Naukri adapter.
- [ ] Unsupported pages return `unknown` safely.
- [ ] Old Naukri-only extractor is not injected.

## Naukri listing

- [ ] Naukri search page reports `listing`.
- [ ] Detected jobs > 0.
- [ ] Normalized jobs > 0.
- [ ] Every normalized listing job has a title.
- [ ] Every available company/location/experience/salary field is scoped to its own card.
- [ ] Sidebar/filter text never becomes a job field.
- [ ] Listing jobs are inserted into the shared job cache.

## Naukri detail

- [ ] A `job-listings-` page reports `detail`.
- [ ] JSON-LD JobPosting is preferred where available.
- [ ] DOM fallback is scoped to the detail page.
- [ ] Detail capture enriches the same stable job key when an ID is available.
- [ ] Full description is not taken from search-results body text.

## Normalization

- [ ] Listing and detail adapters produce the same normalized Job model.
- [ ] Experience min/max parsing is portal-independent.
- [ ] Missing fields remain empty/unknown.
- [ ] Extraction confidence is clearly separate from future match scoring.

## Regression

- [ ] Stage 1 profile still loads.
- [ ] Stage 2 preferences still load.
- [ ] Stage 3 Naukri search verification still works.
- [ ] Stage 4 dashboard reads `jobpilot.stage4.portalCapture`.
- [ ] Toolbar routing opens Stage 4 after a valid listing/detail capture.
