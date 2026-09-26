# JobPilot 1.2 — Multi-portal feed + weekly gap intelligence

## Combined portal feed

- [ ] Naukri listing capture is retained.
- [ ] Foundit listing capture is retained separately.
- [ ] LinkedIn Jobs listing capture is retained separately.
- [ ] Indeed listing capture is retained separately.
- [ ] Hirist listing capture is retained separately.
- [ ] Opening a new portal does not erase previously captured portal listings.
- [ ] Job List combines all captured portals.
- [ ] Portal filter can isolate one source.
- [ ] Portal source cards show captured job counts.
- [ ] Portal source cards can reopen the latest captured search.
- [ ] An uncaptured portal card opens the portal so the user can search/capture jobs.

## Weekly gap intelligence

Each deep-analyzed job produces one deduplicated gap snapshot.

- [ ] Same job recalculation does not create multiple weekly counts.
- [ ] Missing required skills are stored.
- [ ] Missing preferred skills are stored.
- [ ] Hard blockers are stored.
- [ ] General gaps are stored.
- [ ] Match % and APPLY / REVIEW FIRST / SKIP are stored with the snapshot.
- [ ] Existing cached deep matches can contribute immediately.
- [ ] Insights use a rolling 7-day window.
- [ ] Top missing requirements show unique-job frequency.
- [ ] Portal sources are shown for recurring gaps.

## Profile integrity

Weekly insights must never tell a user to falsely claim a skill.

UI guidance:

- If the user genuinely has a recurring skill but it is missing from the profile/resume, surface it with real evidence.
- If the user does not have it, treat it as a learning/practice target.
- Recurrence means “frequently requested by analyzed jobs”, not “the user definitely has this skill”.

## Current limitation

JobPilot does not scrape unopened portals in the background.
A portal contributes jobs after the user visits/captures a supported listing page.
