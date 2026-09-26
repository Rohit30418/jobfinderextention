# Stage 5 — Deep Match acceptance checklist

Stage 5 compares one captured detail job against the saved Stage 1 profile and Stage 2 preferences.

## Inputs

- [ ] Stage 1 profile is required.
- [ ] Stage 2 preferences are required.
- [ ] A Stage 4 detail job is required.
- [ ] Puter AI enrichment is optional but used when present.
- [ ] Portal facts remain authoritative.

## Hard blockers

- [ ] Excluded title/role terms can block a job.
- [ ] Strict experience mode blocks a candidate who is clearly below the job minimum.
- [ ] AI role-family evidence can block a clearly different role family.
- [ ] Saved work-mode mismatch can block when both sides are known.
- [ ] Saved employment-type mismatch can block when both sides are known.
- [ ] Unknown values never become blockers.

## Role fit

- [ ] Target roles come from Stage 2 and saved profile roles/current role.
- [ ] Generic words such as developer/engineer do not create a false role match.
- [ ] Frontend/React signals can align with frontend targets.
- [ ] Java/Spring full-stack roles do not become frontend matches from generic words alone.

## Skills

- [ ] AI required skills are preferred when available.
- [ ] Deterministic Stage 4 required skills are fallback.
- [ ] Required matched and missing skills are shown separately.
- [ ] Preferred matched and missing skills are shown separately.
- [ ] Common aliases such as React.js/React, JS/JavaScript, TS/TypeScript, Redux Toolkit/Redux, RESTful/REST are normalized.
- [ ] Missing skills are evidence gaps, not invented blockers.

## Experience and preferences

- [ ] Candidate experience comes from Stage 1 totalExperienceMonths.
- [ ] Job min/max experience comes from normalized Stage 4 data.
- [ ] Preferred location is checked only when both preference and job location exist.
- [ ] Work mode is checked only when explicitly available.
- [ ] Employment type is checked only when explicitly available.
- [ ] Unknown remains Unknown.

## Verdicts

Allowed Stage 5 v1 verdicts:

- [ ] STRONG FIT
- [ ] POSSIBLE FIT
- [ ] WEAK FIT
- [ ] REVIEW
- [ ] BLOCKED

Rules:

- [ ] Any hard blocker produces BLOCKED.
- [ ] STRONG FIT requires role compatibility, no below-minimum experience, at least 75% identified required-skill coverage, and very few gaps.
- [ ] POSSIBLE FIT requires role compatibility and useful required-skill coverage.
- [ ] No numeric candidate/job match percentage is shown in Stage 5 v1.

## Confidence

- [ ] Confidence describes evidence completeness, not candidate quality.
- [ ] HIGH / MEDIUM / LOW is based on available job evidence.
- [ ] AI enrichment increases evidence completeness but does not determine the verdict alone.

## Persistence

- [ ] Deep match is saved on the normalized job.
- [ ] Portal recapture preserves deep match.
- [ ] Updating profile invalidates/recalculates old match.
- [ ] Updating preferences invalidates/recalculates old match.
- [ ] Re-running Puter AI invalidates/recalculates old match.

## UX

- [ ] Stage 4 has an “Open Stage 5 Deep Match” action.
- [ ] Stage 5 shows hard blockers separately.
- [ ] Stage 5 shows strengths separately.
- [ ] Stage 5 shows gaps separately.
- [ ] Stage 5 shows review/unknown items separately.
- [ ] Required/preferred skill coverage is visible.
- [ ] Explicit must-have requirements are visible.
- [ ] Explicit AI/JD constraints are visible.
- [ ] Toolbar opens Stage 5 after a deep match exists.

- [ ] Java does not match JavaScript by substring.
- [ ] A saved minimum-salary preference is surfaced as not scored until universal salary normalization exists.
