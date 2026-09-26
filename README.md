# JobPilot

JobPilot is being built in verified stages.

The repository currently contains:

- **Stage 1 — Candidate Profile**
- **Stage 2 — Job Preferences**

There is still **no job portal integration or match scoring** in this build.

## Stage 1 — Candidate Profile

Flow:

1. Upload PDF / DOCX / TXT / MD, or paste resume text.
2. Extract locally.
3. Run a text-quality gate.
4. Preview and edit exactly what JobPilot read.
5. Optionally use Puter AI to structure the validated resume.
6. Review/edit the candidate profile.
7. Save the confirmed profile locally.
8. Replace or delete the resume/profile.
9. Use Developer Diagnostics to inspect each layer.

Stage 1 stores **what the candidate has**.

## Stage 2 — Job Preferences

Stage 2 stores **what jobs the candidate wants** without changing Stage 1.

Preferences include:

- target/search roles
- priority keywords
- preferred locations
- minimum/maximum experience
- work mode
- employment type
- posting freshness
- excluded title/role keywords
- optional minimum salary + currency
- future strict-filter behavior

On first use, Stage 2 copies target roles and keywords from the saved Stage 1 profile as editable starting suggestions.

### Important separation

```text
Stage 1 profile = candidate evidence
Stage 2 preferences = search intent
```

Clearing Stage 2 preferences does **not** delete the resume or Stage 1 profile.

## Not included yet

- Naukri integration
- LinkedIn Jobs integration
- Indeed integration
- Foundit integration
- portal URL generation
- job page detection
- job-card scoring
- AI job analysis
- inline badges
- application tracking

These come only after Stage 2 persistence and validation are stable.

## Install once

Run:

    git clone https://github.com/Rohit30418/jobfinderextention.git C:\JobPilot

Then:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Choose **Load unpacked**
4. Select `C:\JobPilot`

Do not uninstall/reinstall on each update.

## Update during development

Run:

    cd C:\JobPilot
    git pull

Then:

`chrome://extensions` → JobPilot → **Reload**

The toolbar icon now behaves like this:

```text
No saved Stage 1 profile
        ↓
Open Stage 1

Saved Stage 1 profile
        ↓
Open Stage 2 Preferences
```

## Acceptance checklists

- Stage 1: `tests/STAGE1_CHECKLIST.md`
- Stage 2: `tests/STAGE2_CHECKLIST.md`

## Privacy model

The confirmed Stage 1 profile, validated resume text and Stage 2 preferences are stored in Chrome extension local storage.

The original uploaded resume file is stored in IndexedDB.

Resume text is sent to Puter only when the user explicitly connects/authorizes Puter and clicks the AI analysis button.

See `PRIVACY.md`.
