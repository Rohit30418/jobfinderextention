# Match Percentage — v0.9.1

## Meaning

- [ ] Match % measures candidate/job compatibility, not extraction completeness.
- [ ] Evidence confidence is displayed separately.
- [ ] APPLY / REVIEW FIRST / SKIP remains the application action layer.
- [ ] A high match % cannot override a hard blocker.

## Weighted inputs

Default maximum weights:

- Role fit: 25
- Required skills: 35
- Experience: 15
- Location: 10 when the user saved preferred locations
- Preferred skills: 5 when the JD identifies them
- Work mode: 5 when the user saved a work-mode preference and the job states one
- Employment type: 5 when the user saved a preference and the job states one

Only assessed/applicable criteria enter the percentage denominator.

## Safety caps

- [ ] Any hard blocker caps the score at 39%.
- [ ] Unknown required skills cap the score at 79%.
- [ ] Weak role alignment caps the score at 54%.
- [ ] Candidate experience below the stated minimum caps the score at 69%.
- [ ] Location mismatch caps the score at 74%.
- [ ] LOW evidence confidence caps the score at 69%.
- [ ] MEDIUM evidence confidence caps the score at 84%.

## UI

- [ ] Portal detail panel shows the match percentage prominently.
- [ ] Portal panel shows the score label.
- [ ] Portal panel shows a visual progress bar.
- [ ] Full Stage 5 report shows match %.
- [ ] Full Stage 5 report shows score components and weighted points.
- [ ] Match % note explains that the application decision has precedence for blockers/mandatory requirements.

## False-positive guards

- [ ] Java does not match JavaScript.
- [ ] Generic words such as Developer/Engineer do not produce a role match alone.
- [ ] Missing/unknown portal facts are not counted as positive matches.
