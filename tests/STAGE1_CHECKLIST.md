# Stage 1 manual test checklist

Do not add any job portal until these checks are stable.

## Resume input

- [ ] Normal PDF extracts readable text.
- [ ] DOCX extracts readable text.
- [ ] TXT/MD extracts readable text.
- [ ] A PDF that produces symbol garbage is rejected by the quality gate.
- [ ] Pasted resume text can pass validation.

## Validation

- [ ] Word count changes when preview text is edited.
- [ ] Obvious symbol garbage lowers the quality score.
- [ ] Too little text disables Continue.
- [ ] Clean text enables Continue.

## Profile

- [ ] A profile can be completed manually with AI unused.
- [ ] Puter sign-in succeeds.
- [ ] Puter AI permission succeeds.
- [ ] AI extraction fills profile suggestions.
- [ ] AI does not save automatically.
- [ ] Manual edits remain in the saved profile.

## Persistence

- [ ] Save profile.
- [ ] Close the setup page.
- [ ] Reload the extension.
- [ ] Saved profile is still present.
- [ ] Diagnostics show the real saved state.

## Replace/delete

- [ ] Replace resume with a different file.
- [ ] Confirm the new resume/profile replaces the old data only after Save.
- [ ] Delete resume/profile.
- [ ] Diagnostics return to incomplete state.