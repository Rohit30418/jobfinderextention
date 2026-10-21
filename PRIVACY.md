# JobPilot privacy

Updated 21 October 2026 for version 1.12.0.

## Data on your device

JobPilot stores your confirmed profile, extracted resume text and metadata, job preferences, captured job listings and descriptions, match results, application history, notes, and skill-gap history in Chrome extension local storage. The original uploaded resume file is stored separately in IndexedDB. These records stay on your device unless you use the optional transfers described below.

JobPilot reads supported job-portal pages that you visit. It does not submit applications, send messages to employers, or automatically mark jobs applied. Marking a job applied is a tracking action, not proof of submission.

## Optional Puter AI

Uploading a resume does not itself send it to Puter. Clicking the resume AI analysis button sends the validated resume text to Puter after sign-in and AI authorization. The profile suggestions require your review.

After you connect Puter and authorize AI, opening a job-detail page with a complete job description automatically sends the relevant job text, saved profile evidence, and job preferences to Puter for analysis. This automatic full-description analysis runs when connected even if the "Automatically send..." preference is off. It generally reuses cached analysis for unchanged profile, preferences, and job content; manual Refresh can request a new analysis. To keep job-detail analysis entirely local, disconnect Puter or do not connect it in the first place.

Clicking Run AI Agent also sends captured listings/descriptions and relevant saved profile information to Puter. Agent mode processes listings in batches while Job List is open; Stop pauses after the current batch. The automatic-AI preference controls other automatic processing flows but does not disable the connected full-description analysis described above. AI answers may be inaccurate; review important eligibility claims yourself.

The HTTPS sign-in page loads Puter's official JavaScript. Its sign-in and permission prompts communicate with Puter. The bridge sends the token directly to the pinned JobPilot extension ID and accepts only a short-lived sign-in challenge created inside the extension. Tokens and authorization state are kept in trusted extension session storage, excluded from backups, and cleared when the browser session ends or you disconnect. Reconnect after a browser restart. Puter processes transmitted data under its own terms and privacy policy.

## Chrome Sync and exports

A bounded skill-name/status/kind mirror is sent through Chrome Sync when available. Detailed skill evidence stays local. The skill vault shows whether this copy succeeded; export a backup to transfer complete history. Sync availability depends on Chrome/account settings.

JSON backups contain profile/resume text, preferences, captured jobs, applications and skill history. They exclude the original uploaded file, tokens, and the pre-import recovery snapshot. Store downloaded backups privately. Applied-job CSV/JSON exports contain application records and notes. Imported backups are validated before writing; Undo Last Restore restores the one local pre-import snapshot.

## Deletion and retention

Delete resume & profile removes the saved profile/resume text and original uploaded file; derived cached matches are invalidated. It does not remove application history, captured jobs, the skill vault, or previously downloaded exports. Disconnect Puter clears this extension's session credentials; it does not delete information already sent to Puter or sign you out of Puter's website.

Uninstalling the extension removes its local data. Delete downloaded backups separately. A Chrome Sync skill mirror may remain associated with your Chrome account; manage synced extension data in Chrome settings. The current local pre-import snapshot remains until the next import, Undo Last Restore, or Delete resume & profile. Do not use an export as a secure deletion mechanism.
