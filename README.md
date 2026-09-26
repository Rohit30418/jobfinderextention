# JobPilot

JobPilot is being built in verified stages.

The repository currently contains:

- **Stage 1 — Candidate Profile**
- **Stage 2 — Job Preferences**
- **Stage 3 — Naukri Search + Page Verification**

There is now **Naukri-only search integration**, but there is still **no job match scoring or AI job analysis** in this build.

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


## Stage 3 — Naukri Search

Stage 3 reads the saved Stage 2 preferences and generates a Naukri search URL.

Current search inputs:

- primary target role / editable search phrase
- preferred locations
- minimum/maximum experience
- freshness

Freshness mapping:

- 24 hours -> Naukri `jobAge=1`
- 3 days -> `jobAge=3`
- 7 days -> `jobAge=7`
- about 14 days -> Naukri's 15-day bucket (`jobAge=15`)
- 30 days -> `jobAge=30`
- any time -> no `jobAge`

A content script runs only on `https://www.naukri.com/*` and displays a small Stage 3 verification panel.

It detects:

- Naukri search results
- individual Naukri job pages
- login/auth pages
- expired/not-found pages
- unknown pages

On search-result pages, JobPilot compares the stored request with the URL/page evidence and marks each filter as verified or unverified.

Stage 3 does **not**:

- score jobs
- call Puter AI for jobs
- hide jobs
- auto-apply
- click application controls

See `tests/STAGE3_CHECKLIST.md`.


## Stage 4 — Naukri Job Extraction

Stage 4 reads Naukri search-result cards and individual job pages into structured job objects.

Search-result job objects may contain:

- title
- company
- experience
- location
- salary
- skills
- description snippet
- posting age
- job URL
- job ID
- extraction sources
- extraction confidence

Individual job pages prefer Schema.org JSON-LD `JobPosting` data and use Naukri-specific DOM selectors only to fill missing fields.

Important rules:

- Whole-page `document.body.innerText` is not used as the job object.
- Missing fields remain unknown.
- Extraction confidence is separate from future job-match scoring.
- No AI analysis runs in Stage 4.
- No jobs are hidden or auto-applied.

The latest extraction is saved locally and can be reviewed in `stage4/extractor.html`.

See `tests/STAGE4_CHECKLIST.md`.
