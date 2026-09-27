# Production release gates

Automated: run `npm test`, `npm run check`, and `npm run package`. CI repeats these checks and stores the ZIP as a workflow artifact. The browser smoke job loads the real extension with synthetic fixtures; it does not submit applications.

Required live checks before broad distribution:

- Export an old 1.6.2 backup; restore it under the pinned 1.7.0 extension ID. Verify profile, project/work evidence, application notes, and skills. Keep the original file separately.
- In Chrome, open each supported portal (Naukri, Indeed, LinkedIn Jobs, Foundit, Hirist). Check one listing and at least two different detail jobs; verify job IDs, descriptions, experience and navigation. Test signed-in pages if the portal requires authentication.
- Connect a real Puter account through the deployed HTTPS bridge, grant AI permission, manually analyze a resume and a job, and rank a list. Check denied permission, offline operation, disconnect and browser restart. Confirm automatic AI is off until enabled.
- Change a profile skill and preferences while a job is open; check that results refresh and no previous candidate evidence remains.
- Mark/unmark jobs from two tabs; export CSV/JSON, restore a backup, and undo the restore.
- Verify Sync status on two signed-in Chrome profiles if cross-device skill sync is required.

Record Chrome version, portal URLs, date, screenshots/errors, and the exact commit tested. Do not mark unperformed checks as passed. An automated pass is not a guarantee of a bug-free app or a Chrome Web Store approval.
