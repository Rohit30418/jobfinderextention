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


### Stage 1 local resume autofill

After resume text passes the quality gate, JobPilot now runs a local resume-to-profile parser before any AI call.

It can prefill supported facts such as:

- name
- headline
- current role
- explicit total experience
- skills
- education
- projects
- certifications
- resume keywords
- an initial target role based on the extracted current role

The parser is evidence-first: missing or uncertain fields stay blank. Puter AI is optional and may be used only to refine the locally extracted profile after user review.


### Puter HTTPS auth bridge

JobPilot no longer asks Puter to authenticate directly from a `chrome-extension://` page.

The supported flow is:

```text
JobPilot extension
→ HTTPS bridge on GitHub Pages
→ official Puter.js sign-in
→ official Puter AI permission prompt
→ authenticated result posted back only to the JobPilot window that opened the bridge
→ token stored in chrome.storage.local
```

Bridge source:

- `site/puter-auth.html`
- `site/puter-auth.css`
- `site/puter-auth.js`

Deployment workflow:

- `.github/workflows/puter-auth-pages.yml`

Expected bridge URL:

```text
https://rohit30418.github.io/jobfinderextention/puter-auth.html
```

GitHub Pages must use **GitHub Actions** as the publishing source for the repository. This is a one-time repository setting if Pages has not been enabled before.

The bridge itself does not persist the Puter token. It sends the result back to the exact JobPilot popup opener, while the extension validates the bridge origin, popup window, and a per-attempt random state before accepting the token.


## Stage 5 — Deep Match

Stage 5 compares one normalized detail job against:

- the saved Stage 1 candidate profile
- Stage 2 preferences
- verified Stage 4 portal facts
- optional Puter AI JD enrichment

It produces one of:

- `STRONG FIT`
- `POSSIBLE FIT`
- `WEAK FIT`
- `REVIEW`
- `BLOCKED`

Stage 5 v1 intentionally does **not** display a candidate/job percentage.

The engine keeps separate evidence buckets for:

- hard blockers
- strengths
- gaps
- unknown/review items
- required skills
- preferred skills
- experience
- role family
- location
- work mode
- employment type

Important false-positive guards include:

```text
Java != JavaScript
generic "Developer" / "Engineer" words do not create a role match
unknown fields do not count as positive evidence
AI does not override portal facts
```

The Stage 5 result is saved on the normalized job and is recalculated when the profile, preferences, captured job or Puter AI analysis changes.


### Application decision

Stage 5 now includes a deterministic application action on top of the deep-match verdict:

- `APPLY`
- `REVIEW FIRST`
- `SKIP`

This is intentionally separate from match quality.

Example:

```text
Deep Match: STRONG FIT
Application Decision: REVIEW FIRST
Reason: TypeScript is identified as a required skill but is missing from the saved profile.
```

Decision rules:

```text
hard blocker
→ SKIP

no hard blocker + important unresolved requirement/gap
→ REVIEW FIRST

no hard blocker + role compatible + experience acceptable
+ all identified required skills covered
+ location not contradicted + reliable evidence
→ APPLY
```

Preferred-skill gaps and unscored salary alone do not automatically stop an `APPLY` decision.

JobPilot never auto-applies and never prevents the user from opening a job after `SKIP`. The decision is an explainable workflow aid, not an automatic application action.


## Inline detail intelligence

From v0.9.0, the normal job-detail workflow stays on the portal page.

```text
portal detail page
→ detail adapter
→ normalized job
→ optional Puter AI enrichment
→ deterministic deep match
→ APPLY / REVIEW FIRST / SKIP
→ inline JobPilot panel
```

The panel is rendered in Shadow DOM and shows:

- application decision
- deep-match verdict
- evidence confidence
- matched/missing required skills
- matched/missing preferred skills
- reasons and cautions
- Back to Job List
- Refresh
- Open Full Analysis

The original JD can be highlighted directly:

- green: matched required
- red: missing required
- blue: matched preferred
- amber: missing preferred

The last listing page is stored separately so opening a detail page no longer loses the user's search-list context.


## JobPilot 1.0 UX architecture

Normal usage is now split cleanly:

```text
EXTENSION
→ setup / preferences / search settings
→ captured ranked Job List only

PORTAL DETAIL PAGE
→ full JobPilot intelligence inline
→ Match %
→ Evidence confidence
→ APPLY / REVIEW FIRST / SKIP
→ required/preferred skills
→ score breakdown
→ blockers / strengths / gaps / review items
→ explicit requirements / constraints
→ Puter AI interpretation
→ JD highlighting
```

Stage 4 and Stage 5 files remain available as developer/debug surfaces, but they are no longer part of the normal user flow.

The browser-action button opens the saved Job List once a listing has been captured. Detail analysis never requires leaving the original job portal page.
