# Stage 2 manual test checklist

Do not start portal integration until these checks pass.

## Stage 1 separation

- [ ] A saved Stage 1 profile opens Stage 2 from the toolbar icon.
- [ ] Stage 2 shows the saved profile summary.
- [ ] Editing/saving Stage 2 does not change Stage 1 resume text.
- [ ] Editing/saving Stage 2 does not change Stage 1 profile skills or experience.
- [ ] Clearing Stage 2 leaves Stage 1 untouched.

## Initial seeding

- [ ] First Stage 2 load copies Stage 1 target roles when present.
- [ ] If no target roles exist, current role is used as the starting role.
- [ ] Priority keywords are copied from Stage 1 resume keywords when present.
- [ ] If resume keywords are absent, skills are used only as editable starting suggestions.
- [ ] Seeded values are not considered saved until Save Job Preferences is clicked.

## Validation

- [ ] At least one target role is required.
- [ ] Minimum experience cannot be greater than maximum experience.
- [ ] Experience values outside 0–60 are rejected.
- [ ] Negative salary is rejected.
- [ ] Locations may be left empty.
- [ ] Work mode may be left empty.
- [ ] Employment type may be left empty.

## Persistence

- [ ] Save preferences.
- [ ] Close Stage 2.
- [ ] Reopen JobPilot from the toolbar.
- [ ] Saved Stage 2 values are restored.
- [ ] Saved summary is shown.
- [ ] Diagnostics reports Stage 2 Ready.

## Clear

- [ ] Clear preferences.
- [ ] Stage 2 returns to profile-seeded defaults.
- [ ] Saved Stage 2 summary disappears.
- [ ] Stage 1 profile remains saved.
- [ ] Toolbar still opens Stage 2 because Stage 1 still exists.

## Future Stage 3 contract

After Stage 2 passes, Stage 3 may read these preferences to generate a Naukri search.

Stage 3 must not add match scoring yet.
