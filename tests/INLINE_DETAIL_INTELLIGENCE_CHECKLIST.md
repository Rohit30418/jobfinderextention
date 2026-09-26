# Inline Detail Intelligence — v0.9.0

## Detail-page UX

- [ ] Opening a supported job detail page shows one JobPilot right-side panel.
- [ ] The old basic Stage 4 detail overlay disappears once the richer panel is active.
- [ ] The panel waits until the portal JD is ready.
- [ ] The panel automatically runs the deterministic deep match.
- [ ] If Puter is already connected and authorized, AI enrichment runs once for a new job.
- [ ] Reopening an already analyzed job reuses cached AI enrichment.
- [ ] Refresh runs the detail analysis again.

## Decision

- [ ] APPLY / REVIEW FIRST / SKIP is visible directly on the portal page.
- [ ] Deep-match verdict and evidence confidence remain visible separately.
- [ ] Required matched/missing skills are visible.
- [ ] Preferred matched/missing skills are visible.
- [ ] Reasons and cautions are visible.
- [ ] No percentage match is displayed.

## JD highlighting

- [ ] Matched required skills are highlighted green.
- [ ] Missing required skills are highlighted red.
- [ ] Matched preferred skills are highlighted blue.
- [ ] Missing preferred skills are highlighted amber.
- [ ] Exact-boundary highlighting prevents Java from matching inside JavaScript.
- [ ] Existing JobPilot highlights are safely replaced when the analyzed job changes.

## Navigation

- [ ] Listing capture is saved separately from detail capture.
- [ ] Back to Job List returns to the last captured listing URL.
- [ ] When no listing context exists, Back to Job List falls back to browser history.
- [ ] Opening a detail page does not destroy the saved listing context.
- [ ] Full Analysis opens the Stage 5 dashboard.

## Isolation

- [ ] Panel UI is rendered inside Shadow DOM.
- [ ] Portal CSS does not alter JobPilot panel styles.
- [ ] JobPilot panel CSS does not alter portal layout.
- [ ] Only intentional JD highlight marks are inserted into portal content.

## Multi-portal architecture

- [ ] Inline panel consumes the normalized Job model, not Naukri-specific selectors.
- [ ] Portal-specific extraction remains inside each portal adapter.
- [ ] Future LinkedIn/Indeed/Foundit detail adapters can reuse the same inline panel.
