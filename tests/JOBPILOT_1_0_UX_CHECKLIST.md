# JobPilot 1.0 — UX architecture

## Extension UI

Normal extension usage contains:

- profile/setup
- preferences
- portal search settings
- captured/ranked job list

The extension does NOT require the user to open Stage 4 or Stage 5 for normal detail analysis.

## Job list

- [ ] Toolbar opens the saved Job List when a listing has been captured.
- [ ] Job list retains the last captured portal listing while the user opens detail jobs.
- [ ] Relevant / Review / Filtered status is visible.
- [ ] Previously analyzed jobs show their saved Match %.
- [ ] Previously analyzed jobs show APPLY / REVIEW FIRST / SKIP.
- [ ] Open Job launches the original portal detail URL.
- [ ] Search/filter inside the extension list works.

## Portal detail page

- [ ] Full analysis stays on the actual job portal page.
- [ ] Match % is visible.
- [ ] Match score label is visible.
- [ ] Evidence confidence is visible separately.
- [ ] APPLY / REVIEW FIRST / SKIP is visible.
- [ ] Required matched/missing skills are visible.
- [ ] Preferred matched/missing skills are visible.
- [ ] Score breakdown is visible.
- [ ] Role and experience comparison is visible.
- [ ] Hard blockers are visible.
- [ ] Strong signals are visible.
- [ ] Gaps are visible.
- [ ] Review/unknown items are visible.
- [ ] Explicit requirements are visible.
- [ ] Explicit constraints are visible.
- [ ] Puter AI role family/seniority/domain/summary is visible.
- [ ] Responsibilities are visible.
- [ ] JD highlights remain visible on the portal itself.
- [ ] Back to Job List returns to the last captured listing.
- [ ] Refresh Analysis recalculates on the same page.
- [ ] No Open Full Analysis extension-page dependency remains.

## Multi-portal rule

The inline panel consumes the normalized Job model.
Portal-specific selectors stay inside adapters only.
Future LinkedIn / Indeed / Foundit adapters must reuse the same detail intelligence UI.
