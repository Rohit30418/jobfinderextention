import { parseResumeFile } from "../core/resume-parser.js";
import { normalizeResumeText, validateResumeText } from "../core/resume-validator.js";
import { profileFromForm } from "../core/profile-normalizer.js";
import {
  clearState,
  getAiAuthorized,
  getPuterToken,
  getState,
  setState
} from "../core/storage.js";
import {
  deleteResumeFile,
  getResumeFile,
  saveResumeFile
} from "../core/resume-store.js";
import {
  analyzeResumeWithAi,
  authorizePuterAi,
  connectPuter,
  disconnectPuter
} from "../core/puter-client.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

let selectedFile = null;
let currentText = "";
let currentValidation = null;
let currentParser = null;
let existingState = null;
let profileSource = "manual";

const els = {
  resumeFile: $("#resumeFile"),
  selectedFile: $("#selectedFile"),
  pasteText: $("#pasteText"),
  parseFileBtn: $("#parseFileBtn"),
  usePasteBtn: $("#usePasteBtn"),
  parseMessage: $("#parseMessage"),
  resumeSourceStatus: $("#resumeSourceStatus"),
  qualityBadge: $("#qualityBadge"),
  qualityMetrics: $("#qualityMetrics"),
  resumePreview: $("#resumePreview"),
  validationDetails: $("#validationDetails"),
  revalidateBtn: $("#revalidateBtn"),
  continueProfileBtn: $("#continueProfileBtn"),
  backToResumeBtn: $("#backToResumeBtn"),
  connectPuterBtn: $("#connectPuterBtn"),
  authorizeAiBtn: $("#authorizeAiBtn"),
  analyzeAiBtn: $("#analyzeAiBtn"),
  disconnectPuterBtn: $("#disconnectPuterBtn"),
  aiStatus: $("#aiStatus"),
  aiMessage: $("#aiMessage"),
  profileName: $("#profileName"),
  profileHeadline: $("#profileHeadline"),
  profileCurrentRole: $("#profileCurrentRole"),
  experienceYears: $("#experienceYears"),
  experienceMonths: $("#experienceMonths"),
  profileSkills: $("#profileSkills"),
  profileTargetRoles: $("#profileTargetRoles"),
  profileKeywords: $("#profileKeywords"),
  profileEducation: $("#profileEducation"),
  profileCertifications: $("#profileCertifications"),
  profileProjects: $("#profileProjects"),
  backToValidationBtn: $("#backToValidationBtn"),
  reviewProfileBtn: $("#reviewProfileBtn"),
  profileReview: $("#profileReview"),
  saveProfileBtn: $("#saveProfileBtn"),
  saveStatus: $("#saveStatus"),
  saveMessage: $("#saveMessage"),
  editProfileBtn: $("#editProfileBtn"),
  replaceResumeBtn: $("#replaceResumeBtn"),
  deleteProfileBtn: $("#deleteProfileBtn"),
  diagnosticsGrid: $("#diagnosticsGrid"),
  refreshDiagnosticsBtn: $("#refreshDiagnosticsBtn")
};

function setMessage(element, text, type) {
  if (!text) {
    element.textContent = "";
    element.className = "message hidden";
    return;
  }

  element.textContent = text;
  element.className = "message" + (type ? " " + type : "");
}

function setStep(step) {
  $$(".step-panel").forEach((panel) => {
    panel.classList.toggle("hidden", Number(panel.dataset.step) !== Number(step));
  });

  $$("[data-step-nav]").forEach((button) => {
    const value = Number(button.dataset.stepNav);
    button.classList.toggle("is-active", value === Number(step));
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
  refreshDiagnostics();
}

function percent(value) {
  return Math.round(Number(value || 0) * 100) + "%";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderValidation(result) {
  currentValidation = result;
  currentText = result.text;
  els.resumePreview.value = result.text;
  els.qualityBadge.textContent = (result.passed ? "PASS " : "FAIL ") + result.score + "/100";
  els.qualityBadge.style.color = result.passed ? "#a9fac3" : "#ff9ba5";

  const metrics = [
    ["Words", result.metrics.wordCount],
    ["Letters", percent(result.metrics.alphaRatio)],
    ["Printable", percent(result.metrics.printableRatio)],
    ["Symbols", percent(result.metrics.symbolRatio)]
  ];

  els.qualityMetrics.innerHTML = metrics
    .map((item) =>
      '<div class="metric"><strong>' +
      escapeHtml(String(item[1])) +
      '</strong><span>' +
      escapeHtml(item[0]) +
      "</span></div>"
    )
    .join("");

  const positives = result.positives
    .map((item) => '<li class="good">✓ ' + escapeHtml(item) + "</li>")
    .join("");

  const issues = result.issues
    .map((item) => '<li class="bad">✕ ' + escapeHtml(item) + "</li>")
    .join("");

  els.validationDetails.innerHTML =
    '<ul class="validation-list">' +
    (positives || "") +
    (issues || '<li class="good">✓ No blocking quality issues detected.</li>') +
    "</ul>";

  els.continueProfileBtn.disabled = !result.passed;
}

function validateAndShow(text) {
  renderValidation(validateResumeText(text));
  setStep(2);
}

function fileSummary(file) {
  if (!file) return "No file selected.";
  const kb = Math.round(file.size / 1024);
  return file.name + " · " + kb + " KB";
}

function listText(items) {
  return Array.isArray(items) ? items.filter(Boolean).join("\n") : "";
}

function clearProfileForm() {
  [
    els.profileName,
    els.profileHeadline,
    els.profileCurrentRole,
    els.profileSkills,
    els.profileTargetRoles,
    els.profileKeywords,
    els.profileEducation,
    els.profileCertifications,
    els.profileProjects
  ].forEach((element) => {
    element.value = "";
  });

  els.experienceYears.value = "";
  els.experienceMonths.value = "";
  profileSource = "manual";
}

function fillProfile(profile) {
  const months = Math.max(0, Number(profile.totalExperienceMonths || 0));

  els.profileName.value = profile.name || "";
  els.profileHeadline.value = profile.headline || "";
  els.profileCurrentRole.value = profile.currentRole || "";
  els.experienceYears.value = Math.floor(months / 12);
  els.experienceMonths.value = months % 12;
  els.profileSkills.value = listText(profile.skills);
  els.profileTargetRoles.value = listText(profile.targetRoles || profile.suggestedTargetRoles);
  els.profileKeywords.value = listText(profile.resumeKeywords);

  if (Array.isArray(profile.education)) {
    els.profileEducation.value = profile.education
      .map((item) => {
        if (typeof item === "string") return item;
        return [item.qualification, item.institution, item.year, item.details]
          .filter(Boolean)
          .join(" · ");
      })
      .filter(Boolean)
      .join("\n");
  }

  if (Array.isArray(profile.certifications)) {
    els.profileCertifications.value = listText(profile.certifications);
  }

  if (Array.isArray(profile.projects)) {
    els.profileProjects.value = profile.projects
      .map((item) => {
        if (typeof item === "string") return item;
        return [item.name, item.description].filter(Boolean).join(" — ");
      })
      .filter(Boolean)
      .join("\n");
  }
}

function formData() {
  return {
    name: els.profileName.value,
    headline: els.profileHeadline.value,
    currentRole: els.profileCurrentRole.value,
    experienceYears: els.experienceYears.value,
    experienceMonths: els.experienceMonths.value,
    skills: els.profileSkills.value,
    targetRoles: els.profileTargetRoles.value,
    resumeKeywords: els.profileKeywords.value,
    education: els.profileEducation.value,
    certifications: els.profileCertifications.value,
    projects: els.profileProjects.value,
    source: profileSource
  };
}

function currentProfile() {
  return profileFromForm(formData());
}

function renderReview() {
  const profile = currentProfile();
  const experienceYears = Math.floor(profile.totalExperienceMonths / 12);
  const experienceMonths = profile.totalExperienceMonths % 12;

  const items = [
    ["Name", profile.name || "Not provided", ""],
    ["Current role", profile.currentRole || "Not provided", ""],
    ["Experience", experienceYears + "y " + experienceMonths + "m", ""],
    ["Headline", profile.headline || "Not provided", "wide"],
    ["Skills", profile.skills.join(", ") || "None added", "wide"],
    ["Target roles", profile.targetRoles.join(", ") || "None added", ""],
    ["Resume keywords", profile.resumeKeywords.join(", ") || "None added", "wide"],
    ["Education", profile.education.join(" | ") || "None added", "wide"],
    ["Certifications", profile.certifications.join(", ") || "None added", ""],
    ["Projects / work", profile.projects.join(" | ") || "None added", "wide"]
  ];

  els.profileReview.innerHTML = items
    .map((item) =>
      '<div class="review-card ' +
      item[2] +
      '"><div class="label">' +
      escapeHtml(item[0]) +
      '</div><div class="value">' +
      escapeHtml(item[1]) +
      "</div></div>"
    )
    .join("");
}

async function updatePuterUi() {
  const token = await getPuterToken();
  const authorized = await getAiAuthorized();

  els.aiStatus.textContent = !token
    ? "AI optional"
    : authorized
      ? "AI ready"
      : "Puter connected";

  els.connectPuterBtn.disabled = Boolean(token);
  els.authorizeAiBtn.disabled = !token || authorized;
  els.analyzeAiBtn.disabled =
    !token ||
    !authorized ||
    !currentValidation ||
    !currentValidation.passed;
  els.disconnectPuterBtn.disabled = !token;
}

async function refreshDiagnostics() {
  const state = await getState();
  const storedFile = await getResumeFile().catch(() => null);
  const token = await getPuterToken();
  const authorized = await getAiAuthorized();

  const diagnostics = [
    ["PDF.js", Boolean(globalThis.pdfjsLib), globalThis.pdfjsLib ? "Loaded" : "Missing"],
    ["Profile storage", true, state.profile ? "Profile saved" : "No saved profile"],
    [
      "Resume text",
      Boolean(state.resume && state.resume.text),
      state.resume && state.resume.text
        ? state.resume.wordCount + " words"
        : "Not saved"
    ],
    [
      "Original file",
      Boolean(storedFile) || Boolean(state.resume && state.resume.source === "paste"),
      storedFile
        ? storedFile.name
        : state.resume && state.resume.source === "paste"
          ? "Pasted text"
          : "None"
    ],
    [
      "Quality gate",
      Boolean(state.resume && state.resume.validation && state.resume.validation.passed),
      state.resume && state.resume.validation
        ? state.resume.validation.score + "/100"
        : "Not checked"
    ],
    ["Puter", Boolean(token), token ? "Connected" : "Not connected"],
    ["AI permission", authorized, authorized ? "Authorized" : "Not authorized"],
    [
      "Stage 1",
      Boolean(
        state.profile &&
        state.resume &&
        state.resume.validation &&
        state.resume.validation.passed
      ),
      state.profile ? "Profile available" : "Incomplete"
    ]
  ];

  els.diagnosticsGrid.innerHTML = diagnostics
    .map((item) =>
      '<div class="diag ' +
      (item[1] ? "pass" : "fail") +
      '"><strong>' +
      (item[1] ? "PASS" : "WAIT") +
      '</strong><span>' +
      escapeHtml(item[0] + ": " + item[2]) +
      "</span></div>"
    )
    .join("");
}

async function loadExisting() {
  existingState = await getState();

  if (existingState.resume && existingState.resume.text) {
    currentText = existingState.resume.text;
    currentValidation = validateResumeText(currentText);
    currentParser = existingState.resume.parser || null;
    els.resumePreview.value = currentText;
  }

  if (existingState.profile) {
    fillProfile(existingState.profile);
    profileSource = existingState.profile.source || "manual";
    renderReview();
    els.saveStatus.textContent = "Saved";
    setStep(4);
  } else {
    setStep(1);
  }

  await updatePuterUi();
  await refreshDiagnostics();
}

els.resumeFile.addEventListener("change", () => {
  selectedFile =
    els.resumeFile.files && els.resumeFile.files[0]
      ? els.resumeFile.files[0]
      : null;

  els.selectedFile.textContent = fileSummary(selectedFile);
  setMessage(els.parseMessage, "");
});

els.parseFileBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    setMessage(els.parseMessage, "Choose a resume file first.", "error");
    return;
  }

  els.parseFileBtn.disabled = true;
  els.resumeSourceStatus.textContent = "Reading...";
  setMessage(els.parseMessage, "Extracting resume locally...");

  try {
    const parsed = await parseResumeFile(selectedFile);
    currentParser = parsed.parser;

    const normalized = normalizeResumeText(parsed.text);
    const result = validateResumeText(normalized);

    renderValidation(result);
    els.resumeSourceStatus.textContent = parsed.parser;

    setMessage(
      els.parseMessage,
      result.passed
        ? "Resume extracted. Review exactly what JobPilot read."
        : "Extraction completed, but the quality gate rejected the text. Edit it or paste clean resume text.",
      result.passed ? "success" : "error"
    );

    setStep(2);
  } catch (error) {
    currentParser = null;
    els.resumeSourceStatus.textContent = "Failed";

    setMessage(
      els.parseMessage,
      (error && error.message ? error.message : "Resume extraction failed.") +
        " You can use Paste Resume Text instead.",
      "error"
    );
  } finally {
    els.parseFileBtn.disabled = false;
  }
});

els.usePasteBtn.addEventListener("click", () => {
  selectedFile = null;
  currentParser = "paste";

  const text = normalizeResumeText(els.pasteText.value);

  if (!text) {
    setMessage(els.parseMessage, "Paste your resume text first.", "error");
    return;
  }

  validateAndShow(text);
  els.resumeSourceStatus.textContent = "Pasted text";
});

els.revalidateBtn.addEventListener("click", () => {
  renderValidation(validateResumeText(els.resumePreview.value));
});

els.continueProfileBtn.addEventListener("click", () => {
  const result = validateResumeText(els.resumePreview.value);
  renderValidation(result);

  if (!result.passed) {
    return;
  }

  currentText = result.text;
  setStep(3);
  updatePuterUi();
});

els.backToResumeBtn.addEventListener("click", () => setStep(1));
els.backToValidationBtn.addEventListener("click", () => setStep(2));

els.connectPuterBtn.addEventListener("click", async () => {
  setMessage(els.aiMessage, "Opening Puter sign-in...");

  try {
    await connectPuter();
    setMessage(els.aiMessage, "Puter connected. Authorize AI next.", "success");
  } catch (error) {
    setMessage(
      els.aiMessage,
      error.message || "Puter connection failed.",
      "error"
    );
  }

  await updatePuterUi();
  await refreshDiagnostics();
});

els.authorizeAiBtn.addEventListener("click", async () => {
  setMessage(els.aiMessage, "Requesting Puter AI permission...");

  try {
    await authorizePuterAi();
    setMessage(els.aiMessage, "AI permission granted.", "success");
  } catch (error) {
    setMessage(
      els.aiMessage,
      error.message || "AI permission was not granted.",
      "error"
    );
  }

  await updatePuterUi();
  await refreshDiagnostics();
});

els.disconnectPuterBtn.addEventListener("click", async () => {
  await disconnectPuter();
  setMessage(els.aiMessage, "Puter disconnected.");
  await updatePuterUi();
  await refreshDiagnostics();
});

els.analyzeAiBtn.addEventListener("click", async () => {
  const result = validateResumeText(currentText || els.resumePreview.value);

  if (!result.passed) {
    setMessage(
      els.aiMessage,
      "Resume text must pass validation before AI analysis.",
      "error"
    );
    return;
  }

  els.analyzeAiBtn.disabled = true;
  setMessage(
    els.aiMessage,
    "Puter AI is extracting facts from the validated resume..."
  );

  try {
    const aiProfile = await analyzeResumeWithAi(result.text);
    profileSource = "ai-reviewed";

    fillProfile({
      ...aiProfile,
      targetRoles: aiProfile.suggestedTargetRoles
    });

    setMessage(
      els.aiMessage,
      "AI suggestions loaded. Review and edit every field before saving.",
      "success"
    );
  } catch (error) {
    setMessage(
      els.aiMessage,
      error.message || "AI analysis failed.",
      "error"
    );
  } finally {
    await updatePuterUi();
  }
});

els.reviewProfileBtn.addEventListener("click", () => {
  const validation = validateResumeText(
    currentText || els.resumePreview.value
  );

  if (!validation.passed) {
    renderValidation(validation);
    setStep(2);
    return;
  }

  currentText = validation.text;
  currentValidation = validation;
  renderReview();
  setStep(4);
});

els.editProfileBtn.addEventListener("click", () => setStep(3));

els.replaceResumeBtn.addEventListener("click", () => {
  selectedFile = null;
  currentText = "";
  currentValidation = null;
  currentParser = null;

  els.resumeFile.value = "";
  els.selectedFile.textContent = "No file selected.";
  els.pasteText.value = "";
  els.resumePreview.value = "";
  els.resumeSourceStatus.textContent = "Waiting";
  clearProfileForm();

  setMessage(els.parseMessage, "");
  setMessage(els.saveMessage, "");
  setStep(1);
});

els.saveProfileBtn.addEventListener("click", async () => {
  const validation = validateResumeText(
    currentText || els.resumePreview.value
  );

  if (!validation.passed) {
    setMessage(
      els.saveMessage,
      "The resume text no longer passes validation. Go back and fix it.",
      "error"
    );
    return;
  }

  const profile = currentProfile();

  if (
    !profile.name &&
    !profile.currentRole &&
    profile.skills.length === 0 &&
    profile.targetRoles.length === 0
  ) {
    setMessage(
      els.saveMessage,
      "Add at least some profile information before saving.",
      "error"
    );
    return;
  }

  els.saveProfileBtn.disabled = true;

  try {
    if (selectedFile) {
      await saveResumeFile(selectedFile);
    } else if (currentParser === "paste") {
      await deleteResumeFile();
    }

    const oldResume = existingState && existingState.resume
      ? existingState.resume
      : {};

    existingState = await setState({
      version: 1,
      resume: {
        source: selectedFile
          ? "file"
          : currentParser === "paste"
            ? "paste"
            : oldResume.source || "unknown",
        fileName: selectedFile
          ? selectedFile.name
          : oldResume.fileName || "",
        fileType: selectedFile
          ? selectedFile.type
          : oldResume.fileType || "",
        parser: currentParser || oldResume.parser || "manual",
        text: validation.text,
        wordCount: validation.metrics.wordCount,
        validation: {
          passed: validation.passed,
          score: validation.score,
          metrics: validation.metrics
        },
        confirmedAt: new Date().toISOString()
      },
      profile: {
        ...profile,
        confirmedAt: new Date().toISOString()
      }
    });

    currentText = validation.text;
    currentValidation = validation;
    els.saveStatus.textContent = "Saved";

    setMessage(
      els.saveMessage,
      "Stage 1 profile saved locally. This is now the source of truth for later stages.",
      "success"
    );
  } catch (error) {
    setMessage(
      els.saveMessage,
      error.message || "Profile could not be saved.",
      "error"
    );
  } finally {
    els.saveProfileBtn.disabled = false;
    await refreshDiagnostics();
  }
});

els.deleteProfileBtn.addEventListener("click", async () => {
  const confirmed = confirm(
    "Delete the saved resume file, extracted resume text and candidate profile from this browser?"
  );

  if (!confirmed) return;

  await clearState();
  await deleteResumeFile().catch(() => {});

  existingState = null;
  selectedFile = null;
  currentText = "";
  currentValidation = null;
  currentParser = null;

  clearProfileForm();

  els.pasteText.value = "";
  els.resumePreview.value = "";
  els.resumeFile.value = "";
  els.selectedFile.textContent = "No file selected.";
  els.resumeSourceStatus.textContent = "Waiting";
  els.saveStatus.textContent = "Not saved";

  setMessage(els.parseMessage, "");
  setMessage(els.saveMessage, "");

  setStep(1);
  await refreshDiagnostics();
});

els.refreshDiagnosticsBtn.addEventListener(
  "click",
  refreshDiagnostics
);

$$("[data-step-nav]").forEach((button) => {
  button.addEventListener("click", () => {
    const requested = Number(button.dataset.stepNav);

    if (requested === 1) {
      setStep(1);
    }

    if (requested === 2 && currentText) {
      renderValidation(
        currentValidation || validateResumeText(currentText)
      );
      setStep(2);
    }

    if (
      requested === 3 &&
      currentValidation &&
      currentValidation.passed
    ) {
      setStep(3);
    }

    if (
      requested === 4 &&
      ((existingState && existingState.profile) ||
        (currentValidation && currentValidation.passed))
    ) {
      renderReview();
      setStep(4);
    }
  });
});

loadExisting().catch((error) => {
  console.error("JobPilot Stage 1 failed to initialize", error);

  setMessage(
    els.parseMessage,
    "Initialization failed: " +
      (error.message || String(error)),
    "error"
  );
});
