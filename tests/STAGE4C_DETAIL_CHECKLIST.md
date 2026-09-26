# Stage 4C — Detail page enrichment

Stage 4C enriches an already captured listing job when the user opens its individual job-detail page.

## Page detection

- [ ] Naukri `/job-listings-...` page reports `detail`.
- [ ] Search/listing pages never enter detail mode.
- [ ] Only the universal Portal Capture overlay is visible.

## Identity and cache enrichment

- [ ] Detail capture extracts portal job ID from JSON-LD when available.
- [ ] URL numeric ID is used as fallback.
- [ ] Existing cached listing job is found by stable key, portal job ID, or canonical URL.
- [ ] Detail data enriches that existing record instead of creating a duplicate.
- [ ] `status.detailLoaded` becomes true.

## Portal facts

- [ ] Title extracted.
- [ ] Company extracted.
- [ ] Experience extracted.
- [ ] Month-based experience such as `72 months` is normalized to years.
- [ ] Location extracted.
- [ ] Numeric/range salary text is preferred over weak values such as `INR P.A.`.
- [ ] Skills combine JSON-LD and detail-page skill chips without duplicates.
- [ ] Date posted extracted when available.
- [ ] Employment type extracted when available.
- [ ] Work mode inferred only when explicitly evidenced by JD/location text.
- [ ] Education remains unknown unless explicit evidence exists.

## JD enrichment

- [ ] Full description is captured from JSON-LD or detail-scoped DOM.
- [ ] Requirement statements are extracted only from explicit requirement language.
- [ ] Preferred statements use preferred / nice-to-have / good-to-have language.
- [ ] Required skills are derived only from skills mentioned in explicit requirement statements.
- [ ] Preferred skills are derived only from preferred statements.
- [ ] Responsibilities are extracted from action-oriented JD statements.
- [ ] Missing enrichment fields remain Unknown.

## UI

- [ ] Detail overlay shows extraction method.
- [ ] Detail overlay shows required/preferred/responsibility counts.
- [ ] Stage 4 dashboard shows Required skills.
- [ ] Stage 4 dashboard shows Preferred skills.
- [ ] Stage 4 dashboard shows Responsibilities.
- [ ] Stage 4 dashboard shows Requirement statements.
- [ ] Stage 4 dashboard shows Full job description.
- [ ] Extraction completeness is never presented as a candidate/job match percentage.

## Safety / architecture

- [ ] No AI call is required for Stage 4C.
- [ ] No candidate match score is calculated.
- [ ] No auto-apply action occurs.
- [ ] No whole-page body text is used as the job object.
- [ ] Portal-specific extraction remains inside `portals/naukri/detail.js`.
