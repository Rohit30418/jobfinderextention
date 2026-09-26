# Stage 3 — Naukri manual test checklist

Stage 3 scope is intentionally limited to Naukri search generation, page-type detection and filter verification.

## Setup gate

- [ ] Saved Stage 1 profile is detected.
- [ ] Saved Stage 2 preferences are detected.
- [ ] Toolbar icon opens Stage 3 when both are ready.
- [ ] Missing Stage 1 or Stage 2 blocks Stage 3 safely.

## Search generation

- [ ] Primary role dropdown uses saved target roles.
- [ ] Search phrase defaults to the selected role.
- [ ] Preferred locations load from Stage 2.
- [ ] Experience min/max load from Stage 2.
- [ ] Freshness loads from Stage 2.
- [ ] 24h maps to jobAge=1.
- [ ] 3d maps to jobAge=3.
- [ ] 7d maps to jobAge=7.
- [ ] 14d explicitly maps to Naukri's 15-day bucket.
- [ ] 30d maps to jobAge=30.
- [ ] Any time omits jobAge.
- [ ] Generated URL contains k for keyword/search phrase.
- [ ] Generated URL contains l when locations exist.
- [ ] Generated URL contains experience when experience is configured.
- [ ] Invalid experience range blocks opening.

## Naukri page detection

- [ ] Search results page detected.
- [ ] Individual job page detected.
- [ ] Login/auth page detected.
- [ ] Expired/not-found page detected.
- [ ] Unknown page produces safe fallback.
- [ ] Route changes inside Naukri update the overlay without reloading the extension.

## Filter verification overlay

- [ ] Overlay appears on naukri.com pages.
- [ ] Keyword requested/found is shown.
- [ ] Location requested/found is shown.
- [ ] Experience requested/found is shown.
- [ ] Freshness requested/found is shown.
- [ ] Missing/mismatched filters are UNVERIFIED, never silently treated as working.
- [ ] Visible job links count updates.
- [ ] Overlay can be closed.
- [ ] No job match score appears anywhere.

## Regression

- [ ] Stage 1 resume/profile remains unchanged.
- [ ] Stage 2 preferences remain unchanged.
- [ ] Puter AI is not called in Stage 3.
- [ ] No automatic job applications or clicks occur.
