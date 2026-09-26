# Stage 4 — Naukri Job Extraction checklist

Stage 4 is extraction-only. No candidate matching, AI ranking, auto-apply or job hiding is allowed in this stage.

## Search result cards

- [ ] Naukri search-results page is detected.
- [ ] Visible job links are discovered from Naukri job-listing URLs.
- [ ] Each parsed card has a title and job URL.
- [ ] Company is extracted when visible.
- [ ] Experience is extracted from card DOM or card-scoped fallback only.
- [ ] Location is extracted when visible.
- [ ] Salary is extracted when visible; otherwise remains Unknown.
- [ ] Posting age is extracted when visible.
- [ ] Skills/tags are extracted when visible.
- [ ] Description snippet comes only from the card container.
- [ ] Job ID is parsed from the job URL when possible.
- [ ] Whole-page body text is never used as the job object.
- [ ] Duplicate job links are de-duplicated.
- [ ] Maximum stored cards is bounded.

## Job detail

- [ ] Individual Naukri job page is detected.
- [ ] JSON-LD JobPosting is preferred when available.
- [ ] DOM fallback fills only missing JSON-LD fields.
- [ ] Title is extracted.
- [ ] Company is extracted.
- [ ] Full description is extracted from job-description scope.
- [ ] Experience is extracted.
- [ ] Location is extracted.
- [ ] Salary is extracted when available.
- [ ] Skills are extracted.
- [ ] Date posted / posted age is extracted when available.
- [ ] Employment type is extracted when available.
- [ ] Education requirement is extracted when available.
- [ ] Job ID and URL are retained.
- [ ] Missing fields remain Unknown.

## Extraction confidence

- [ ] Confidence is based only on extraction completeness.
- [ ] HIGH / MEDIUM / LOW labels are visible.
- [ ] Missing fields are listed.
- [ ] Extraction confidence is explicitly labeled as NOT a job-match score.
- [ ] Unknown fields never receive positive match points.

## Persistence and dashboard

- [ ] Latest extraction is stored in chrome.storage.local.
- [ ] Stage 4 dashboard shows detected, parsed and failed counts.
- [ ] Dashboard lists HIGH / MEDIUM / LOW counts.
- [ ] Search-result jobs can be reviewed individually.
- [ ] Job-detail fields and field sources are reviewable.
- [ ] Source Naukri page can be reopened.
- [ ] Clearing Stage 4 does not delete Stage 1–3 data.
- [ ] Toolbar opens Stage 4 after a valid extraction exists.

## Regression

- [ ] Stage 1 profile remains unchanged.
- [ ] Stage 2 preferences remain unchanged.
- [ ] Stage 3 Naukri search and verification remain unchanged.
- [ ] Puter AI is not called.
- [ ] No match percentage is displayed.
- [ ] No job is automatically hidden.
- [ ] No application button is clicked.
