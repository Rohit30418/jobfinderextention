import {
  getPortalCapture,
  getPreferences,
  getState,
  saveJobDeepMatch
} from "../core/storage.js";

import {
  evaluateDeepMatch
} from "../core/match-engine.js";

const $ = (selector) => document.querySelector(selector);

const els = {
  gatePanel: $("#gatePanel"),
  jobTitle: $("#jobTitle"),
  jobMeta: $("#jobMeta"),
  gateStatus: $("#gateStatus"),
  gateMessage: $("#gateMessage"),
  openJobBtn: $("#openJobBtn"),
  recalculateBtn: $("#recalculateBtn"),
  matchApp: $("#matchApp"),

  applyDecisionPanel: $("#applyDecisionPanel"),
  applyDecisionAction: $("#applyDecisionAction"),
  applyDecisionHeadline: $("#applyDecisionHeadline"),
  applyDecisionSummary: $("#applyDecisionSummary"),
  applyDecisionConfidence: $("#applyDecisionConfidence"),
  applyDecisionReasons: $("#applyDecisionReasons"),
  applyDecisionCautions: $("#applyDecisionCautions"),
  applyDecisionNextStep: $("#applyDecisionNextStep"),
  decisionOpenJobBtn: $("#decisionOpenJobBtn"),

  hero: $(".hero-result"),
  verdict: $("#verdict"),
  verdictSummary: $("#verdictSummary"),
  matchScore: $("#matchScore"),
  matchScoreLabel: $("#matchScoreLabel"),
  matchScoreFill: $("#matchScoreFill"),
  confidence: $("#confidence"),
  confidenceMeta: $("#confidenceMeta"),
  scoreBreakdown: $("#scoreBreakdown"),
  scoreAssessedWeight: $("#scoreAssessedWeight"),

  blockerCount: $("#blockerCount"),
  strengthCount: $("#strengthCount"),
  gapCount: $("#gapCount"),
  reviewCount: $("#reviewCount"),

  blockerChip: $("#blockerChip"),
  strengthChip: $("#strengthChip"),
  gapChip: $("#gapChip"),
  reviewChip: $("#reviewChip"),

  blockers: $("#blockers"),
  strengths: $("#strengths"),
  gaps: $("#gaps"),
  reviewItems: $("#reviewItems"),

  coreGrid: $("#coreGrid"),
  requiredMatched: $("#requiredMatched"),
  requiredMissing: $("#requiredMissing"),
  preferredMatched: $("#preferredMatched"),
  preferredMissing: $("#preferredMissing"),

  explicitRequirements: $("#explicitRequirements"),
  explicitDisqualifiers: $("#explicitDisqualifiers"),
  sourceBanner: $("#sourceBanner"),
  diagnosticsGrid: $("#diagnosticsGrid")
};

let state = null;
let preferences = null;
let capture = null;
let currentJob = null;
let currentMatch = null;
let initializeTimer = null;
let initializeInFlight = null;
let lastRenderedSignature = "";

function stableArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).sort()
    : [];
}

function hashText(value) {
  const text = String(value || "");
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function semanticJobPayload(job) {
  const ai = job?.aiAnalysis || {};

  return {
    key: job?.key || "",
    portal: job?.portal || "",
    portalJobId: job?.portalJobId || "",
    canonicalUrl: String(job?.canonicalUrl || "").split("?")[0],
    title: job?.title || "",
    company: job?.company || "",
    experienceText: job?.experienceText || "",
    experienceMin: job?.experienceMin ?? null,
    experienceMax: job?.experienceMax ?? null,
    location: job?.location || "",
    workMode: job?.workMode || "",
    employmentType: job?.employmentType || "",
    requiredSkills: stableArray(job?.requiredSkills),
    preferredSkills: stableArray(job?.preferredSkills),
    descriptionHash: hashText(job?.description || ""),
    ai: {
      roleFamily: ai.roleFamily || "",
      seniority: ai.seniority || "",
      workMode: ai.workMode || "",
      employmentType: ai.employmentType || "",
      requiredSkills: stableArray(ai.requiredSkills),
      preferredSkills: stableArray(ai.preferredSkills),
      mustHaveRequirements: stableArray(ai.mustHaveRequirements),
      disqualifiers: stableArray(ai.disqualifiers),
      analyzedAt: job?.aiAnalyzedAt || ai.analyzedAt || null
    }
  };
}

function inputSignature(profileState, prefs, job) {
  return hashText(
    JSON.stringify({
      profileUpdatedAt: profileState?.updatedAt || null,
      preferencesUpdatedAt: prefs?.updatedAt || null,
      job: semanticJobPayload(job)
    })
  );
}

function sameSemanticJob(a, b) {
  return hashText(JSON.stringify(semanticJobPayload(a))) ===
    hashText(JSON.stringify(semanticJobPayload(b)));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setGateMessage(text, type = "") {
  if (!text) {
    els.gateMessage.className = "notice hidden";
    els.gateMessage.textContent = "";
    return;
  }

  els.gateMessage.textContent = text;
  els.gateMessage.className =
    "notice" + (type ? " " + type : "");
}

function showList(element, items, kind) {
  const list = Array.isArray(items) ? items : [];

  if (!list.length) {
    element.innerHTML =
      '<div class="empty">None.</div>';
    return;
  }

  element.innerHTML = list.map((item) =>
    '<div class="evidence-item ' + kind + '">' +
      '<strong>' + escapeHtml(item.label || "Evidence") + '</strong>' +
      '<span>' + escapeHtml(item.detail || "") + '</span>' +
    '</div>'
  ).join("");
}

function showSkills(element, values, kind) {
  const list = Array.isArray(values) ? values : [];

  element.innerHTML = list.length
    ? list.map((skill) =>
        '<span class="skill ' + kind + '">' +
          escapeHtml(skill) +
        '</span>'
      ).join("")
    : '<span class="empty">None identified.</span>';
}

function showTextLines(element, values) {
  const list = Array.isArray(values) ? values : [];

  element.innerHTML = list.length
    ? list.map((item) =>
        '<div class="text-line">' +
          escapeHtml(item) +
        '</div>'
      ).join("")
    : '<div class="empty">None identified.</div>';
}

function verdictSummary(match) {
  if (match.verdict === "BLOCKED") {
    return "One or more explicit blockers were found. Review those before spending time on this application.";
  }

  if (match.verdict === "STRONG FIT") {
    return "Role, experience and identified requirements align well with the saved profile.";
  }

  if (match.verdict === "POSSIBLE FIT") {
    return "The job is relevant and has useful overlap, but there are still gaps or unknowns worth reviewing.";
  }

  if (match.verdict === "WEAK FIT") {
    return "Some signals align, but the current evidence shows meaningful gaps.";
  }

  return "JobPilot does not yet have enough positive evidence for a confident fit decision.";
}

function renderApplyDecision(match) {
  const decision = match?.applyDecision || {
    action: "REVIEW FIRST",
    headline: "Check this job before applying",
    summary: "The application decision is unavailable for this saved match.",
    reasons: [],
    cautions: [],
    nextStep: "Recalculate the deep match.",
    confidence: match?.confidence?.level || "LOW"
  };

  els.applyDecisionPanel.dataset.action = decision.action;
  els.applyDecisionAction.textContent = decision.action;
  els.applyDecisionHeadline.textContent = decision.headline;
  els.applyDecisionSummary.textContent = decision.summary;
  els.applyDecisionConfidence.textContent =
    decision.confidence || match?.confidence?.level || "LOW";
  els.applyDecisionNextStep.textContent = decision.nextStep || "";

  const reasonKind =
    decision.action === "SKIP"
      ? "blocker"
      : "strength";

  showList(
    els.applyDecisionReasons,
    decision.reasons || [],
    reasonKind
  );

  showList(
    els.applyDecisionCautions,
    decision.cautions || [],
    decision.action === "SKIP" ? "blocker" : "gap"
  );

  if (els.decisionOpenJobBtn) {
    els.decisionOpenJobBtn.textContent =
      decision.action === "APPLY"
        ? "Open job to apply →"
        : decision.action === "SKIP"
          ? "Open job anyway →"
          : "Open job to review →";
    els.decisionOpenJobBtn.disabled = !currentJob?.canonicalUrl;
  }
}

function renderCore(match, job) {
  const roleDetail =
    match.role.exact?.length
      ? "Target phrase matched"
      : match.role.tokenHits?.length
        ? match.role.tokenHits.join(", ")
        : "No strong role signal";

  const exp =
    match.experience.candidateYears == null
      ? "Unknown"
      : match.experience.candidateYears + " years";

  const fields = [
    ["Target role fit", match.role.compatible ? "Compatible" : "Weak / review"],
    ["Role evidence", roleDetail],
    ["AI role family", match.source.roleFamily || "Not available"],
    ["AI seniority", match.source.seniority || "Not available"],
    ["Candidate experience", exp],
    ["Job experience", job.experienceText || "Unknown"],
    ["Location", job.location || "Unknown"],
    ["Location result", match.location.status],
    ["Work mode", job.workMode || job.aiAnalysis?.workMode || "Unknown"],
    ["Employment type", job.employmentType || job.aiAnalysis?.employmentType || "Unknown"],
    [
      "Required skill coverage",
      match.skills.required.coverage == null
        ? "Unknown"
        : match.skills.required.matched.length +
          "/" +
          match.skills.required.all.length
    ],
    [
      "Puter AI enrichment",
      match.source.aiEnriched ? "Used" : "Not available"
    ]
  ];

  els.coreGrid.innerHTML = fields.map(([label, value]) =>
    '<div class="detail-field">' +
      '<div class="label">' + escapeHtml(label) + '</div>' +
      '<div class="value">' + escapeHtml(String(value)) + '</div>' +
    '</div>'
  ).join("");
}

function renderMatch(match, job) {
  currentMatch = match;

  els.matchApp.classList.remove("hidden");
  renderApplyDecision(match);
  els.hero.dataset.verdict = match.verdict;
  els.verdict.textContent = match.verdict;
  els.verdictSummary.textContent = verdictSummary(match);

  const score = match.matchScore?.score;
  els.matchScore.textContent =
    Number.isFinite(score) ? score + "%" : "--%";
  els.matchScoreLabel.textContent =
    match.matchScore?.label || "Insufficient data";
  els.matchScoreFill.style.width =
    Number.isFinite(score) ? score + "%" : "0%";

  const scoreComponents = match.matchScore?.components || [];
  els.scoreAssessedWeight.textContent =
    (match.matchScore?.assessedWeight || 0) + " weighted evidence";
  els.scoreBreakdown.innerHTML = scoreComponents.length
    ? scoreComponents.map((component) =>
        '<div class="detail-field">' +
          '<div class="label">' + escapeHtml(component.label) + '</div>' +
          '<div class="value">' +
            escapeHtml(
              component.points + "/" + component.weight +
              " · " + component.detail
            ) +
          '</div>' +
        '</div>'
      ).join("")
    : '<div class="empty">Not enough evidence to calculate a score breakdown.</div>';

  els.confidence.textContent = match.confidence.level;
  els.confidenceMeta.textContent =
    match.confidence.evidence +
    "/" +
    match.confidence.possible +
    " evidence groups available";

  const counts = {
    blockers: match.blockers.length,
    strengths: match.strengths.length,
    gaps: match.gaps.length,
    review: match.review.length
  };

  els.blockerCount.textContent = counts.blockers;
  els.strengthCount.textContent = counts.strengths;
  els.gapCount.textContent = counts.gaps;
  els.reviewCount.textContent = counts.review;

  els.blockerChip.textContent = counts.blockers;
  els.strengthChip.textContent = counts.strengths;
  els.gapChip.textContent = counts.gaps;
  els.reviewChip.textContent = counts.review;

  showList(els.blockers, match.blockers, "blocker");
  showList(els.strengths, match.strengths, "strength");
  showList(els.gaps, match.gaps, "gap");
  showList(els.reviewItems, match.review, "review");

  renderCore(match, job);

  showSkills(
    els.requiredMatched,
    match.skills.required.matched,
    "good"
  );
  showSkills(
    els.requiredMissing,
    match.skills.required.missing,
    "bad"
  );
  showSkills(
    els.preferredMatched,
    match.skills.preferred.matched,
    "good"
  );
  showSkills(
    els.preferredMissing,
    match.skills.preferred.missing,
    ""
  );

  showTextLines(
    els.explicitRequirements,
    match.explicitRequirements
  );

  showTextLines(
    els.explicitDisqualifiers,
    match.explicitDisqualifiers
  );

  els.sourceBanner.textContent =
    match.source.aiEnriched
      ? "Puter AI enrichment was used for semantic JD structure. Portal facts and deterministic profile comparisons remain authoritative."
      : "Puter AI enrichment is not available for this job. Stage 5 is using portal facts and deterministic JD extraction only.";
}

async function renderDiagnostics() {
  const diagnostics = [
    ["Stage 1 profile", Boolean(state?.profile), state?.profile ? "Ready" : "Missing"],
    [
      "Stage 2 preferences",
      Boolean(preferences?.updatedAt),
      preferences?.updatedAt ? "Ready" : "Missing"
    ],
    [
      "Detail job",
      Boolean(currentJob),
      currentJob ? currentJob.title || currentJob.key : "Missing"
    ],
    [
      "AI enrichment",
      Boolean(currentJob?.aiAnalysis),
      currentJob?.aiAnalysis ? "Available" : "Optional / missing"
    ],
    [
      "Deep match",
      Boolean(currentMatch),
      currentMatch ? currentMatch.verdict : "Not calculated"
    ],
    [
      "Application decision",
      Boolean(currentMatch?.applyDecision?.action),
      currentMatch?.applyDecision?.action || "Not calculated"
    ],
    [
      "Hard blockers",
      Boolean(currentMatch && currentMatch.blockers.length === 0),
      currentMatch
        ? currentMatch.blockers.length + " found"
        : "Unknown"
    ],
    [
      "Required skills",
      Boolean(currentMatch?.skills?.required),
      currentMatch
        ? currentMatch.skills.required.matched.length +
          "/" +
          currentMatch.skills.required.all.length +
          " matched"
        : "Unknown"
    ],
    [
      "Match percentage",
      Number.isFinite(currentMatch?.matchScore?.score),
      Number.isFinite(currentMatch?.matchScore?.score)
        ? currentMatch.matchScore.score + "% · " + currentMatch.matchScore.label
        : "Insufficient evidence"
    ]
  ];

  els.diagnosticsGrid.innerHTML = diagnostics.map((item) =>
    '<div class="diag ' + (item[1] ? "pass" : "") + '">' +
      '<strong>' + (item[1] ? "PASS" : "WAIT") + '</strong>' +
      '<span>' + escapeHtml(item[0] + ": " + item[2]) + '</span>' +
    '</div>'
  ).join("");
}

async function calculateAndSave(options = {}) {
  if (!state?.profile || !currentJob) return;

  const silent = options.silent === true;

  if (!silent) {
    els.recalculateBtn.disabled = true;
    els.recalculateBtn.textContent = "Calculating…";
  }

  try {
    const match = evaluateDeepMatch(
      state.profile,
      preferences,
      currentJob
    );

    const signature = inputSignature(
      state,
      preferences,
      currentJob
    );

    match.inputs = {
      signature,
      profileUpdatedAt: state.updatedAt || null,
      preferencesUpdatedAt: preferences.updatedAt || null,
      aiAnalyzedAt: currentJob.aiAnalyzedAt || null
    };

    await saveJobDeepMatch(
      currentJob.key,
      match
    );

    capture = await getPortalCapture();
    currentJob = capture.detail || currentJob;

    renderMatch(match, currentJob);
    lastRenderedSignature = match.inputs?.signature || "";

    if (!silent) {
      setGateMessage(
        "Deep match recalculated and saved on this job.",
        "success"
      );
    }

    await renderDiagnostics();
  } catch (error) {
    setGateMessage(
      error?.message || String(error),
      "error"
    );
  } finally {
    if (!silent) {
      els.recalculateBtn.disabled = false;
      els.recalculateBtn.textContent = "Recalculate deep match";
    }
  }
}

async function initialize() {
  [state, preferences, capture] = await Promise.all([
    getState(),
    getPreferences(),
    getPortalCapture()
  ]);

  const profile = state?.profile;
  currentJob =
    capture?.pageType === "detail"
      ? capture.detail
      : null;

  if (!profile) {
    els.jobTitle.textContent = "Stage 1 profile is missing";
    els.jobMeta.textContent =
      "Save a candidate profile before running Stage 5.";
    els.gateStatus.textContent = "Blocked";
    els.recalculateBtn.disabled = true;
    return;
  }

  if (!preferences?.updatedAt) {
    els.jobTitle.textContent = "Stage 2 preferences are missing";
    els.jobMeta.textContent =
      "Save job preferences before running Stage 5.";
    els.gateStatus.textContent = "Blocked";
    els.recalculateBtn.disabled = true;
    return;
  }

  if (!currentJob) {
    els.jobTitle.textContent = "Open a job-detail page first";
    els.jobMeta.textContent =
      "Stage 5 works on one normalized detail job at a time.";
    els.gateStatus.textContent = "Waiting";
    els.recalculateBtn.disabled = true;
    els.openJobBtn.disabled = true;
    return;
  }

  els.jobTitle.textContent =
    currentJob.title || "Captured job";
  els.jobMeta.textContent =
    [
      currentJob.company,
      currentJob.experienceText,
      currentJob.location,
      currentJob.portal
    ].filter(Boolean).join(" · ");

  els.gateStatus.textContent = "Ready";
  els.openJobBtn.disabled = !currentJob.canonicalUrl;

  const existing = currentJob.deepMatch;
  const signature = inputSignature(
    state,
    preferences,
    currentJob
  );

  const existingFresh = Boolean(
    existing &&
    existing.version === 3 &&
    existing.inputs?.signature === signature
  );

  if (existingFresh) {
    if (lastRenderedSignature !== signature) {
      renderMatch(existing, currentJob);
      lastRenderedSignature = signature;
    }
  } else {
    await calculateAndSave({
      silent: Boolean(currentMatch)
    });
  }

  await renderDiagnostics();
}

els.openJobBtn.addEventListener("click", async () => {
  if (currentJob?.canonicalUrl) {
    await chrome.tabs.create({
      url: currentJob.canonicalUrl
    });
  }
});

els.decisionOpenJobBtn?.addEventListener("click", async () => {
  if (currentJob?.canonicalUrl) {
    await chrome.tabs.create({
      url: currentJob.canonicalUrl
    });
  }
});

els.recalculateBtn.addEventListener(
  "click",
  () => calculateAndSave({ silent: false })
);

function scheduleInitialize(delay = 180) {
  clearTimeout(initializeTimer);
  initializeTimer = setTimeout(() => {
    if (!initializeInFlight) {
      initializeInFlight = initialize()
        .catch(() => {})
        .finally(() => {
          initializeInFlight = null;
        });
    }
  }, delay);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (
    changes["jobpilot.stage1.state"] ||
    changes["jobpilot.stage2.preferences"]
  ) {
    scheduleInitialize();
    return;
  }

  const portalChange =
    changes["jobpilot.stage4.portalCapture"];

  if (!portalChange) return;

  const oldDetail =
    portalChange.oldValue?.pageType === "detail"
      ? portalChange.oldValue.detail
      : null;

  const newDetail =
    portalChange.newValue?.pageType === "detail"
      ? portalChange.newValue.detail
      : null;

  // Ignore timestamp-only recaptures and our own deepMatch writes.
  if (
    oldDetail &&
    newDetail &&
    sameSemanticJob(oldDetail, newDetail)
  ) {
    return;
  }

  scheduleInitialize();
});

initialize().catch((error) => {
  els.jobTitle.textContent = "Stage 5 could not initialize";
  els.jobMeta.textContent = error?.message || String(error);
  els.gateStatus.textContent = "Error";
  setGateMessage(
    error?.message || String(error),
    "error"
  );
});
