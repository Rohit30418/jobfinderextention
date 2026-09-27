# JobPilot 1.10.0 — Two-stage AI screening

- Listing-page AI results are now explicitly PROVISIONAL.
- Listing AI can shortlist or screen out, but it cannot produce a final APPLY verdict.
- Full job-description analysis is explicitly FINAL and can return APPLY / REVIEW / SKIP.
- Added 0–100 Frontend Relevance score.
- Added role composition: FRONTEND_HEAVY, BALANCED_FULLSTACK, BACKEND_HEAVY, NON_FRONTEND, UNKNOWN.
- Backend-heavy / non-frontend roles are capped at low frontend relevance.
- Long listing snippets can no longer be mistaken for a full JD.
- AI ranking now uses frontend relevance as an additional ordering signal.

# JobPilot 1.9.0 — AI Job Agent Upgrade

- AI-ranked job feed based on the saved candidate profile and job preferences.
- Evidence-grounded 0–100 fit score with role, skills, experience, preferences and evidence-quality breakdown.
- Explicit AI priority (HIGH / MEDIUM / LOW / HOLD) and safer ordering: APPLY → REVIEW → SKIP.
- Full “why apply / why not apply” review, missing skills, verified conflicts, unknowns, evidence and next step.
- Listing-only results are automatically treated as lower-confidence than full job descriptions.
- Project skills can support capability fit but are not promoted to commercial years of experience.
- Existing Chrome storage keys and saved JobPilot data are preserved.

# 1.8.0 — AI job finding agent

- Shared AI recommendation for Job List and Job Intelligence, with estimated suitability, role alignment, confidence, reasons to apply/avoid, unknowns and quoted evidence.
- Uses captured full descriptions where available; listing-only advice is marked provisional. Verifies evidence quotes and downgrades unsupported recommendations.
- Recommended shows APPLY only, ordered by score; Review, Pending AI and Not recommended preserve visibility of other jobs.
- Resumable two-job batches, progress, stop, saved results and opt-in automatic analysis while Job List is open. Job details use AI automatically in agent mode. No automatic applications.
- Prior analysis is invalidated for the new model; profile, applications and skills are preserved. Replace files in the same folder and Reload; do not uninstall.

# JobPilot 1.7.1 hotfix

Fixes setup initialization when background storage messaging returns no response. Extension pages now access storage under the same origin-wide Web Lock as the service worker, preserving concurrent-write protection without requiring a background RPC for every profile read/save.

The extension ID and storage keys are unchanged from 1.7.0. Existing 1.7.0 users can replace the files in the SAME installed folder, click Reload in chrome://extensions, and close/reopen JobPilot tabs. Do not uninstall. Keep a backup when available.

# JobPilot 1.7.0

This release addresses the September 27 audit findings. It adds serialized storage mutations, strict job identity, input-bound analysis caching, conservative skill matching, decimal/unknown experience handling, validated backups with undo, bounded skill sync with visible status, safe CSV export, timeout/backoff/local AI recovery, Indeed split-pane detection, preserved profile evidence, automated regression checks, and updated privacy controls.

## Upgrade an existing unpacked installation

1. In the OLD installation, choose Export Backup before changing anything. Keep the original resume file separately.
2. Extract the new ZIP into a new folder and load that folder through chrome://extensions → Developer mode → Load unpacked. Chrome 120 or newer is required.
3. A stable public manifest key pins this release's extension ID. An old unpacked installation without that key may have a different ID and separate storage. Restore your backup in the new installation, verify your profile and application history, and then remove the old installation to prevent duplicate panels.
4. Reconnect Puter. The updated HTTPS bridge must be deployed with this release. Reconnect again after restarting Chrome because credentials are session-only.
5. Automatic AI is off by default. You can enable it explicitly in Preferences; local matching works without it.

Before a Chrome Web Store release, verify that the store-assigned public key/ID matches the pinned bridge ID. Do not change either independently. The public key in the manifest is not a private signing key.

## Verification scope

Automated tests use synthetic profiles and portal fixtures, never real applications. They cannot certify current selectors across every live portal, real Puter account permissions/billing, or Chrome Web Store acceptance. Complete the release checklist in tests/production-checklist.md before describing the extension as fully production-validated.
