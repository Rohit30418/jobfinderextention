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
