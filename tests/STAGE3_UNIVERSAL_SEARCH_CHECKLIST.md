# Stage 3 Universal Search Hub — v1.3.0

## Shared input

- [ ] Primary role comes from Stage 2 target roles.
- [ ] Search terms are editable and comma-separated.
- [ ] Locations come from Stage 2 but are editable.
- [ ] Min/max experience is editable.
- [ ] Freshness is editable.
- [ ] User can select any subset of supported portals.
- [ ] Open Selected Searches opens one tab per selected portal.
- [ ] Search state persists locally.

## Naukri

- [ ] Uses k= for search terms.
- [ ] Uses l= for location text.
- [ ] Uses jobAge for freshness.
- [ ] Uses learned experience value only when context matches.
- [ ] Uses learned cityTypeGid values only when context matches.
- [ ] No fake experience/city encoding is invented.

## Foundit

URL pattern based on supplied live search:

- [ ] /search/<term>-jobs-in-<location>
- [ ] start=1
- [ ] limit=20
- [ ] query=<comma-separated terms>
- [ ] location=<first location>
- [ ] queryEntity=<primary role>:DESIGNATION
- [ ] experienceRanges=<min>~<max> only when both are known
- [ ] queryDerived=true
- [ ] jobFreshness=<days>

## LinkedIn Jobs

- [ ] /jobs/search/
- [ ] keywords=<search terms>
- [ ] location=<first location>
- [ ] f_TPR=r<seconds> for freshness
- [ ] sortBy=DD when freshness is used
- [ ] Years of experience are NOT mapped to f_E.
- [ ] LinkedIn career-level filters remain separate from year ranges.

## Indeed

URL pattern based on supplied live search:

- [ ] /jobs
- [ ] q=<search terms>
- [ ] l=<first location>
- [ ] sort=date
- [ ] fromage=<days>
- [ ] from=searchOnDesktopSerp
- [ ] vjk is NOT generated because it is a job-specific value.
- [ ] Experience years are not invented into the URL.

## Hirist

URL pattern based on supplied live search:

- [ ] /search/<role>-jobs
- [ ] loc=<first location>
- [ ] minexp=<minimum>
- [ ] maxexp=<maximum>
- [ ] sort=date
- [ ] posting=<days>
- [ ] category/searchType/method preserved as empty query fields.
- [ ] One clean search/location is generated at a time.

## After opening

- [ ] Portal listing is captured by its adapter.
- [ ] Captured jobs appear in the combined Job List.
- [ ] Detail pages show inline Match % and deep analysis.
