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

## Local profile autofill

- [ ] A validated uploaded resume auto-fills the profile without Puter.
- [ ] Name is filled only when a plausible name is present in the resume header.
- [ ] Headline is filled from the resume header when available.
- [ ] Current role is derived from experience/summary/headline evidence.
- [ ] Explicit total experience such as "4 years of professional experience" is converted to months.
- [ ] Skills are extracted from the resume Skills section.
- [ ] Education is extracted from the Education section.
- [ ] Projects are extracted from the Projects section.
- [ ] Certifications remain blank when no Certifications section exists.
- [ ] Target roles default only to the locally extracted current role; no invented roles are added.
- [ ] Missing/uncertain facts remain blank rather than being invented.
- [ ] Puter AI remains optional.
- [ ] Going Back → Continue again does not overwrite profile edits unless the resume text changed.
