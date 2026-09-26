# JobPilot Portal Adapter Architecture

JobPilot Stage 4 is portal-agnostic.

## Core flow

```text
Current browser page
        ↓
Portal Runtime
        ↓
Portal Registry / Adapter detection
        ↓
┌────────────────────┬────────────────────┐
│ Listing pipeline   │ Detail pipeline    │
│ many lightweight  │ one rich job       │
│ jobs               │                    │
└────────────────────┴────────────────────┘
        ↓
Normalized Job model
        ↓
Shared local job cache
        ↓
Stage 4 dashboard
```

## Adapter contract

Every portal adapter must provide:

```js
{
  id,
  displayName,
  version,

  matches(url),
  detectPage(),

  captureListing(),
  captureDetail()
}
```

`detectPage()` returns:

- `listing`
- `detail`
- `unknown`

## Listing capture

Listing pages should capture only lightweight fields:

- portal job ID
- canonical job URL
- title
- company
- location
- experience text
- salary text
- visible skills/tags
- visible description snippet
- posting age

Listing capture must never treat the entire page as one job.

## Detail capture

Detail pages enrich the same normalized job with:

- full description
- required/preferred skills where available
- responsibilities where available
- education
- employment type
- work mode
- date posted
- richer location / salary / experience evidence

Detail adapters should prefer structured data such as JSON-LD when available and use detail-scoped DOM only as fallback.

## Normalized job model

All portals output the same shared shape:

```js
{
  key,
  portal,
  portalJobId,
  canonicalUrl,

  title,
  company,
  location,

  experienceText,
  experienceMin,
  experienceMax,
  salaryText,

  skills,
  snippet,
  postedAge,
  datePosted,

  description,
  responsibilities,
  requiredSkills,
  preferredSkills,
  education,
  employmentType,
  workMode,

  listing,
  detail,

  extraction,
  status,
  sources,
  capturedAt
}
```

## Stable job identity

Preferred key:

```text
portal + portalJobId
```

Fallback key:

```text
portal + hash(canonical URL + title + company)
```

This lets a detail page enrich the listing-page record instead of creating an unrelated duplicate.

## Current adapters

### Naukri

Files:

- `portals/naukri/listing.js`
- `portals/naukri/detail.js`
- `portals/naukri/adapter.js`

### Future

Add the same three-part structure for:

- LinkedIn
- Indeed
- Foundit
- other portals

The shared core, dashboard, cache and later matching engine should not contain portal-specific selectors.

## Extraction strategy

Each adapter may evolve independently:

```text
network / embedded structured data
        ↓
portal-specific DOM fallback
        ↓
unavailable
```

The shared runtime does not care how the adapter obtained the data.

## Stage 4 rule

Extraction confidence is not candidate/job match confidence.

Stage 4 does not:

- score candidate fit
- call AI for job ranking
- auto-apply
- hide jobs
