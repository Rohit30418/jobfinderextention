# JobPilot

JobPilot is being built in verified stages. This repository currently contains **Stage 1 only**.

## Stage 1 goal

Create a trustworthy, reusable candidate profile before any job search or scoring logic exists.

Flow:

1. Upload PDF / DOCX / TXT / MD, or paste resume text.
2. Extract locally.
3. Run a quality gate.
4. Preview and edit exactly what JobPilot read.
5. Optionally use Puter AI to structure the validated resume.
6. Review and edit the candidate profile.
7. Save the confirmed profile locally.
8. Replace or delete the resume/profile at any time.
9. Use Developer Diagnostics to see which layer is ready.

## Intentionally not included yet

- Naukri
- LinkedIn Jobs
- Indeed
- Foundit
- Date filters
- Job page detection
- Job match percentages
- Inline badges
- Application tracking

Those features come only after Stage 1 passes testing.

## Install once

Run:

    git clone https://github.com/Rohit30418/jobfinderextention.git C:\JobPilot

Then open chrome://extensions, enable Developer mode, choose Load unpacked, and select C:\JobPilot.

After that, do not uninstall/reinstall for every update.

## Update during development

Run:

    cd C:\JobPilot
    git pull

Then go to chrome://extensions and press Reload on JobPilot.

## Stage 1 acceptance checklist

- [ ] PDF resume extracts readable text
- [ ] DOCX resume extracts readable text
- [ ] TXT/MD resume extracts readable text
- [ ] Garbage/corrupt extraction is rejected
- [ ] Pasted resume text works
- [ ] Preview can be edited and revalidated
- [ ] Puter connection works
- [ ] Puter AI permission works
- [ ] AI profile suggestions load
- [ ] AI failure does not block manual profile setup
- [ ] Manual edits override AI suggestions
- [ ] Profile survives browser/extension reload
- [ ] Original uploaded file is retained locally
- [ ] Replace resume works
- [ ] Delete resume/profile works
- [ ] Diagnostics reflect the actual saved state

## Privacy model

The confirmed profile and validated resume text are stored in Chrome local extension storage.
The original uploaded file is stored in IndexedDB.

Resume text is sent to Puter only when the user explicitly clicks Analyze resume with AI after connecting and authorizing Puter AI.

See PRIVACY.md.