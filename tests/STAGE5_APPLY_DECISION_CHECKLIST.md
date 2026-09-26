# Stage 5.2 — Apply Decision checklist

The application decision is a deterministic action layer built on top of Stage 5 Deep Match.

Allowed actions:

- APPLY
- REVIEW FIRST
- SKIP

## SKIP

- [ ] Any Stage 5 hard blocker results in SKIP.
- [ ] BLOCKED deep-match verdict results in SKIP.
- [ ] Reasons show the exact blocker(s).
- [ ] Job can still be opened manually; JobPilot never prevents the user from overriding it.

## REVIEW FIRST

- [ ] Missing identified required skills produce REVIEW FIRST rather than an automatic SKIP.
- [ ] Candidate experience below the stated range produces REVIEW FIRST unless strict experience is enabled, in which case it can become a hard blocker.
- [ ] Weak role alignment produces REVIEW FIRST when a hard role-family blocker is not established.
- [ ] Location mismatch produces REVIEW FIRST unless another saved hard constraint already blocks the job.
- [ ] Unknown required skills produce REVIEW FIRST.
- [ ] Explicit AI/JD disqualifier text produces REVIEW FIRST unless JobPilot can deterministically prove the candidate fails it.
- [ ] Low evidence confidence produces REVIEW FIRST.
- [ ] Important unknowns stay visible.

## APPLY

APPLY requires all of the following:

- [ ] No hard blocker.
- [ ] Compatible target role.
- [ ] Candidate is not below the stated experience minimum.
- [ ] Required skills were actually identified.
- [ ] No identified required skill is missing from the saved profile.
- [ ] Required-skill coverage is at least 75%.
- [ ] Saved location is not contradicted.
- [ ] Evidence confidence is not LOW.
- [ ] No unresolved explicit disqualifier exists.

Soft items may remain without preventing APPLY:

- [ ] Preferred skill missing.
- [ ] Salary not normalized/scored yet.
- [ ] Candidate experience is above the stated maximum.

## UX

- [ ] Application decision is more prominent than the raw deep-match verdict.
- [ ] APPLY is green.
- [ ] REVIEW FIRST is amber.
- [ ] SKIP is red.
- [ ] Decision confidence is shown separately.
- [ ] Reasons and cautions are separate.
- [ ] Next action is explicit.
- [ ] APPLY offers “Open job to apply”.
- [ ] REVIEW FIRST offers “Open job to review”.
- [ ] SKIP still allows “Open job anyway”.
- [ ] No auto-apply occurs.
- [ ] No AI-generated recommendation overrides deterministic rules.
