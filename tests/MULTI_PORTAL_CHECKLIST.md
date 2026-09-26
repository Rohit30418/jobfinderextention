# Multi-Portal support — v1.1.0

Supported portals:

- Naukri
- Foundit
- LinkedIn Jobs
- Indeed
- Hirist

## Universal flow

Listing page:
- [ ] Portal detected
- [ ] Visible job cards captured
- [ ] Jobs normalized to the universal Job schema
- [ ] Relevance gate marks Relevant / Review / Filtered
- [ ] Latest listing is visible in Stage 6 Job List

Detail page:
- [ ] Portal detected as detail
- [ ] Title captured
- [ ] Company captured
- [ ] Job description captured
- [ ] Experience/location/skills captured when available
- [ ] Puter AI enrichment can run
- [ ] Deep Match runs
- [ ] Match % is visible
- [ ] APPLY / REVIEW FIRST / SKIP is visible
- [ ] JD highlights use exact skill boundaries
- [ ] Back to Job List returns to same portal listing when available

## Portal-specific checks

### Foundit
- [ ] /search/... recognized as listing
- [ ] /job/... recognized as detail

### LinkedIn Jobs
- [ ] /jobs/search recognized as listing
- [ ] /jobs/collections recognized as listing
- [ ] /jobs/view/... recognized as detail
- [ ] JobPilot does not inject on normal LinkedIn feed/profile pages

### Indeed
- [ ] /jobs and query/category job pages recognized as listing
- [ ] /viewjob recognized as detail

### Hirist
- [ ] Job-card links using /j/... captured
- [ ] /j/... recognized as detail

## Important

Portal DOMs change frequently.
If one portal changes markup, tune only its selectors/config; the universal match and AI layers should not be changed.
