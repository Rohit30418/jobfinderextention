# JobPilot Stage 1 privacy notes

Stage 1 is local-first.

## Stored locally

JobPilot stores:

- validated resume text
- confirmed candidate profile
- resume metadata
- original uploaded resume file
- Puter connection state/token if the user chooses to connect Puter

The profile and text use Chrome extension local storage.
The original resume file uses IndexedDB.

## Puter AI

No resume text is sent to Puter merely because a resume was uploaded.

The validated resume text is sent only after the user connects Puter, grants AI permission, and clicks Analyze resume with AI.

The AI result is treated as a suggestion. The user reviews and edits it before saving the confirmed profile.

## Delete

Delete resume & profile removes the Stage 1 profile state and original resume file from this browser.

Disconnecting Puter removes the locally stored Puter token and AI authorization marker.