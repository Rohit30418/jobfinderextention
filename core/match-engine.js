function clean(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/front[ -]?end/g, "frontend")
    .replace(/back[ -]?end/g, "backend")
    .replace(/full[ -]?stack/g, "fullstack")
    .replace(/react\.?js/g, "react")
    .replace(/node\.?js/g, "node")
    .replace(/vue\.?js/g, "vue")
    .replace(/angular\.?js/g, "angular")
    .replace(/java\s*script/g, "javascript")
    .replace(/type\s*script/g, "typescript")
    .replace(/restful/g, "rest")
    .replace(/\bapis\b/g, "api")
    .replace(/redux toolkit/g, "redux")
    .replace(/html5/g, "html")
    .replace(/css3/g, "css")
    .replace(/\.net|dot\s*net/g, "dotnet")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_ROLE_WORDS = new Set([
  "developer","engineer","engineering","software","web","application","applications",
  "specialist","consultant","associate","senior","junior","lead","manager","analyst",
  "executive","officer","professional","expert","staff","principal","intern","trainee"
]);

const ROLE_FAMILY_GROUPS = [
  ["frontend","react","javascript","ui"],
  ["backend","server","api"],
  ["fullstack"],
  ["android","mobile"],
  ["ios","mobile"],
  ["qa","testing","tester","automation"],
  ["devops","cloud","sre"],
  ["data","analytics","bi","machine","ml","ai"],
  ["java","spring"],
  ["dotnet","c#"],
  ["php","laravel"],
  ["python","django","flask"],
  ["node","nodejs"]
];

function unique(values, max = 100) {
  const output = [];
  const seen = new Set();

  for (const item of values || []) {
    const value = String(item || "").trim();
    if (!value) continue;

    const key = clean(value);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    output.push(value);
    if (output.length >= max) break;
  }

  return output;
}

function list(value) {
  if (Array.isArray(value)) return unique(value);
  return unique(
    String(value || "")
      .split(/[\n,;|]/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function tokens(value) {
  return [...new Set(clean(value).split(" ").filter(Boolean))];
}

function roleTokens(value) {
  return tokens(value).filter(
    (token) => token.length > 1 && !GENERIC_ROLE_WORDS.has(token)
  );
}

function includesTerm(haystack, needle) {
  const h = " " + clean(haystack) + " ";
  const n = clean(needle);
  return Boolean(n) && h.includes(" " + n + " ");
}

function findTerms(haystack, terms) {
  return list(terms).filter((term) => includesTerm(haystack, term));
}

function flattenProfileText(profile) {
  const values = [
    profile?.headline,
    profile?.currentRole,
    ...(profile?.skills || []),
    ...(profile?.resumeKeywords || []),
    ...(profile?.targetRoles || []),
    ...(profile?.certifications || [])
  ];

  for (const item of profile?.workExperience || []) {
    if (typeof item === "string") {
      values.push(item);
      continue;
    }
    values.push(
      item?.title,
      item?.description,
      ...(Array.isArray(item?.skillsUsed) ? item.skillsUsed : [])
    );
  }

  for (const item of profile?.projects || []) {
    if (typeof item === "string") {
      values.push(item);
      continue;
    }
    values.push(
      item?.name,
      item?.description,
      ...(Array.isArray(item?.skillsUsed) ? item.skillsUsed : [])
    );
  }

  return values.filter(Boolean).join(" ");
}

function candidateSkills(profile) {
  const items = [
    ...(profile?.skills || []),
    ...(profile?.resumeKeywords || [])
  ];

  for (const item of profile?.workExperience || []) {
    if (item && typeof item === "object" && Array.isArray(item.skillsUsed)) {
      items.push(...item.skillsUsed);
    }
  }

  for (const item of profile?.projects || []) {
    if (item && typeof item === "object" && Array.isArray(item.skillsUsed)) {
      items.push(...item.skillsUsed);
    }
  }

  return unique(items, 160);
}

function skillMatch(candidateSkillList, jobSkillList) {
  const candidateNormalized = candidateSkillList.map((skill) => ({
    raw: skill,
    normalized: clean(skill)
  }));

  const matched = [];
  const missing = [];

  for (const skill of unique(jobSkillList, 80)) {
    const normalized = clean(skill);
    if (!normalized) continue;

    const hit = candidateNormalized.some((candidate) => {
      if (!candidate.normalized) return false;
      if (candidate.normalized === normalized) return true;

      const candidateTokens = tokens(candidate.normalized);
      const jobTokens = tokens(normalized);

      if (jobTokens.length === 1 && candidateTokens.includes(jobTokens[0])) {
        return true;
      }

      if (candidateTokens.length === 1 && jobTokens.includes(candidateTokens[0])) {
        return true;
      }

      return (
        candidate.normalized.includes(normalized) ||
        normalized.includes(candidate.normalized)
      );
    });

    (hit ? matched : missing).push(skill);
  }

  return { matched, missing };
}

function roleCompatibility(profile, preferences, job) {
  const targetRoles = unique([
    ...(preferences?.targetRoles || []),
    ...(profile?.targetRoles || []),
    ...(profile?.currentRole ? [profile.currentRole] : [])
  ]);

  const jobRole = [
    job?.title,
    job?.aiAnalysis?.roleFamily,
    job?.aiAnalysis?.seniority
  ].filter(Boolean).join(" ");

  const exact = targetRoles.filter((role) => includesTerm(jobRole, role));
  const targetSpecific = [...new Set(targetRoles.flatMap(roleTokens))];
  const jobSpecific = new Set(roleTokens(jobRole));
  const tokenHits = targetSpecific.filter((token) => jobSpecific.has(token));

  const targetGroups = ROLE_FAMILY_GROUPS.filter((group) =>
    group.some((token) => targetSpecific.includes(token))
  );
  const jobGroups = ROLE_FAMILY_GROUPS.filter((group) =>
    group.some((token) => jobSpecific.has(token))
  );

  const familyOverlap = targetGroups.some((targetGroup) =>
    jobGroups.some((jobGroup) =>
      targetGroup.some((token) => jobGroup.includes(token))
    )
  );

  const compatible =
    exact.length > 0 ||
    tokenHits.length > 0 ||
    familyOverlap;

  return {
    compatible,
    exact,
    tokenHits,
    targetRoles,
    jobRole,
    targetSpecific,
    jobSpecific: [...jobSpecific]
  };
}

function candidateExperienceYears(profile) {
  const months = Number(profile?.totalExperienceMonths);
  return Number.isFinite(months) ? Math.round((months / 12) * 10) / 10 : null;
}

function experienceCheck(profile, preferences, job) {
  const candidateYears = candidateExperienceYears(profile);
  const jobMin = Number.isFinite(job?.experienceMin) ? job.experienceMin : null;
  const jobMax = Number.isFinite(job?.experienceMax) ? job.experienceMax : null;

  let candidateStatus = "unknown";

  if (candidateYears !== null && (jobMin !== null || jobMax !== null)) {
    if (jobMin !== null && candidateYears < jobMin) {
      candidateStatus = "below";
    } else if (jobMax !== null && candidateYears > jobMax) {
      candidateStatus = "above";
    } else {
      candidateStatus = "within";
    }
  }

  const prefMin = Number.isFinite(preferences?.experienceMin)
    ? preferences.experienceMin
    : null;
  const prefMax = Number.isFinite(preferences?.experienceMax)
    ? preferences.experienceMax
    : null;

  let preferenceOverlap = null;

  if (
    (jobMin !== null || jobMax !== null) &&
    (prefMin !== null || prefMax !== null)
  ) {
    const aMin = jobMin ?? 0;
    const aMax = jobMax ?? 99;
    const bMin = prefMin ?? 0;
    const bMax = prefMax ?? 99;
    preferenceOverlap = aMin <= bMax && bMin <= aMax;
  }

  return {
    candidateYears,
    jobMin,
    jobMax,
    candidateStatus,
    preferenceOverlap
  };
}

function locationCheck(preferences, job) {
  const preferred = list(preferences?.preferredLocations);
  const location = clean(job?.location);

  if (!preferred.length) {
    return { status: "unrestricted", matches: [] };
  }

  if (!location) {
    return { status: "unknown", matches: [] };
  }

  const matches = preferred.filter((item) =>
    location.includes(clean(item)) ||
    clean(item).includes(location)
  );

  return {
    status: matches.length ? "match" : "mismatch",
    matches
  };
}

function modeCheck(preferences, job) {
  const preferred = list(preferences?.workModes);
  const actual = clean(job?.workMode || job?.aiAnalysis?.workMode);

  if (!preferred.length) {
    return { status: "unrestricted", actual };
  }

  if (!actual) {
    return { status: "unknown", actual };
  }

  const match = preferred.some((item) => actual.includes(clean(item)));
  return { status: match ? "match" : "mismatch", actual };
}

function employmentCheck(preferences, job) {
  const preferred = list(preferences?.employmentTypes);
  const actual = clean(job?.employmentType || job?.aiAnalysis?.employmentType);

  if (!preferred.length) {
    return { status: "unrestricted", actual };
  }

  if (!actual) {
    return { status: "unknown", actual };
  }

  const match = preferred.some((item) => actual.includes(clean(item)));
  return { status: match ? "match" : "mismatch", actual };
}

function explicitExcludedTitleHits(preferences, job) {
  return findTerms(job?.title || "", preferences?.excludedKeywords || []);
}

function hardBlockers(profile, preferences, job, role, experience, location, mode, employment) {
  const blockers = [];
  const excludedHits = explicitExcludedTitleHits(preferences, job);

  if (excludedHits.length && preferences?.hideExcludedTitles !== false) {
    blockers.push({
      code: "excluded-title",
      label: "Excluded role/title",
      detail: excludedHits.join(", ")
    });
  }

  if (
    preferences?.strictExperience === true &&
    experience.candidateStatus === "below"
  ) {
    blockers.push({
      code: "experience-below-minimum",
      label: "Experience below required minimum",
      detail:
        experience.candidateYears + "y profile vs " +
        experience.jobMin + "y minimum"
    });
  }

  if (
    role.targetRoles.length &&
    !role.compatible &&
    job?.aiAnalysis?.roleFamily
  ) {
    blockers.push({
      code: "role-family-mismatch",
      label: "Role family mismatch",
      detail:
        "Target: " + role.targetRoles.slice(0, 3).join(", ") +
        " · Job: " + job.aiAnalysis.roleFamily
    });
  }

  if (mode.status === "mismatch" && preferences?.workModes?.length) {
    blockers.push({
      code: "work-mode-mismatch",
      label: "Work mode mismatch",
      detail: job?.workMode || job?.aiAnalysis?.workMode || "Unknown"
    });
  }

  if (employment.status === "mismatch" && preferences?.employmentTypes?.length) {
    blockers.push({
      code: "employment-type-mismatch",
      label: "Employment type mismatch",
      detail: job?.employmentType || job?.aiAnalysis?.employmentType || "Unknown"
    });
  }

  return blockers;
}

function evidenceConfidence(job, requiredSkills, role) {
  let evidence = 0;
  let possible = 0;

  for (const value of [
    job?.title,
    job?.company,
    job?.experienceText,
    job?.location,
    job?.description
  ]) {
    possible += 1;
    if (String(value || "").trim()) evidence += 1;
  }

  possible += 1;
  if (requiredSkills.length) evidence += 1;

  possible += 1;
  if (role.jobRole) evidence += 1;

  possible += 1;
  if (job?.aiAnalysis) evidence += 1;

  const ratio = possible ? evidence / possible : 0;

  return {
    level: ratio >= 0.8 ? "HIGH" : ratio >= 0.55 ? "MEDIUM" : "LOW",
    evidence,
    possible,
    aiEnriched: Boolean(job?.aiAnalysis)
  };
}

export function evaluateDeepMatch(profile, preferences, job) {
  if (!profile) {
    throw new Error("Stage 1 profile is required.");
  }

  if (!job) {
    throw new Error("Open a captured job-detail page first.");
  }

  const candidateSkillList = candidateSkills(profile);

  const requiredSkills = unique(
    job?.aiAnalysis?.requiredSkills?.length
      ? job.aiAnalysis.requiredSkills
      : job?.requiredSkills || []
  );

  const preferredSkills = unique(
    job?.aiAnalysis?.preferredSkills?.length
      ? job.aiAnalysis.preferredSkills
      : job?.preferredSkills || []
  );

  const required = skillMatch(candidateSkillList, requiredSkills);
  const preferred = skillMatch(candidateSkillList, preferredSkills);

  const role = roleCompatibility(profile, preferences, job);
  const experience = experienceCheck(profile, preferences, job);
  const location = locationCheck(preferences, job);
  const mode = modeCheck(preferences, job);
  const employment = employmentCheck(preferences, job);

  const blockers = hardBlockers(
    profile,
    preferences,
    job,
    role,
    experience,
    location,
    mode,
    employment
  );

  const strengths = [];
  const gaps = [];
  const review = [];

  if (role.compatible) {
    strengths.push({
      code: "role-compatible",
      label: "Role compatibility",
      detail:
        role.exact.length
          ? "Target role phrase matched"
          : role.tokenHits.length
            ? "Shared role signal: " + role.tokenHits.join(", ")
            : "Compatible role family"
    });
  } else {
    gaps.push({
      code: "role-weak",
      label: "Role alignment is weak",
      detail: job?.aiAnalysis?.roleFamily || job?.title || "Unknown role"
    });
  }

  if (requiredSkills.length) {
    if (required.matched.length) {
      strengths.push({
        code: "required-skills-matched",
        label: "Required skills matched",
        detail: required.matched.join(", ")
      });
    }

    if (required.missing.length) {
      gaps.push({
        code: "required-skills-missing",
        label: "Required skills missing from profile",
        detail: required.missing.join(", ")
      });
    }
  } else {
    review.push({
      code: "required-skills-unknown",
      label: "Required skills not clearly identified",
      detail: "Deep skill coverage is less certain."
    });
  }

  if (preferred.matched.length) {
    strengths.push({
      code: "preferred-skills-matched",
      label: "Preferred skills matched",
      detail: preferred.matched.join(", ")
    });
  }

  if (preferred.missing.length) {
    review.push({
      code: "preferred-skills-missing",
      label: "Preferred skills not found in profile",
      detail: preferred.missing.join(", ")
    });
  }

  if (experience.candidateStatus === "within") {
    strengths.push({
      code: "experience-within",
      label: "Experience fits stated range",
      detail:
        experience.candidateYears + "y profile vs " +
        (job?.experienceText || "job range")
    });
  } else if (experience.candidateStatus === "below") {
    gaps.push({
      code: "experience-below",
      label: "Experience below stated range",
      detail:
        experience.candidateYears + "y profile vs " +
        experience.jobMin + "y minimum"
    });
  } else if (experience.candidateStatus === "above") {
    review.push({
      code: "experience-above",
      label: "Experience above stated range",
      detail:
        experience.candidateYears + "y profile vs " +
        experience.jobMax + "y maximum"
    });
  } else {
    review.push({
      code: "experience-unknown",
      label: "Experience comparison unavailable",
      detail: "The job did not expose a reliable experience range."
    });
  }

  if (location.status === "match") {
    strengths.push({
      code: "location-match",
      label: "Preferred location matched",
      detail: location.matches.join(", ")
    });
  } else if (location.status === "mismatch") {
    gaps.push({
      code: "location-mismatch",
      label: "Location outside saved preferences",
      detail: job?.location || "Unknown"
    });
  } else if (location.status === "unknown") {
    review.push({
      code: "location-unknown",
      label: "Location could not be verified",
      detail: "Unknown remains unknown."
    });
  }

  if (mode.status === "match") {
    strengths.push({
      code: "work-mode-match",
      label: "Work mode matched",
      detail: job?.workMode || job?.aiAnalysis?.workMode || ""
    });
  } else if (mode.status === "unknown" && preferences?.workModes?.length) {
    review.push({
      code: "work-mode-unknown",
      label: "Work mode not stated",
      detail: "Saved work-mode preference could not be verified."
    });
  }

  if (employment.status === "match") {
    strengths.push({
      code: "employment-match",
      label: "Employment type matched",
      detail: job?.employmentType || job?.aiAnalysis?.employmentType || ""
    });
  } else if (
    employment.status === "unknown" &&
    preferences?.employmentTypes?.length
  ) {
    review.push({
      code: "employment-unknown",
      label: "Employment type not stated",
      detail: "Saved employment-type preference could not be verified."
    });
  }

  const explicitRequirements = unique(
    job?.aiAnalysis?.mustHaveRequirements || job?.requirementStatements || [],
    30
  );

  const explicitDisqualifiers = unique(
    job?.aiAnalysis?.disqualifiers || [],
    20
  );

  for (const item of explicitDisqualifiers) {
    review.push({
      code: "explicit-disqualifier-review",
      label: "Explicit requirement needs review",
      detail: item
    });
  }

  const requiredTotal = requiredSkills.length;
  const requiredMatched = required.matched.length;
  const requiredCoverage =
    requiredTotal > 0 ? requiredMatched / requiredTotal : null;

  let verdict = "REVIEW";

  if (blockers.length) {
    verdict = "BLOCKED";
  } else if (
    role.compatible &&
    experience.candidateStatus !== "below" &&
    (requiredCoverage === null || requiredCoverage >= 0.75) &&
    gaps.length <= 1
  ) {
    verdict = "STRONG FIT";
  } else if (
    role.compatible &&
    experience.candidateStatus !== "below" &&
    (requiredCoverage === null || requiredCoverage >= 0.5)
  ) {
    verdict = "POSSIBLE FIT";
  } else if (
    role.compatible ||
    (requiredCoverage !== null && requiredCoverage >= 0.5)
  ) {
    verdict = "WEAK FIT";
  }

  const confidence = evidenceConfidence(job, requiredSkills, role);

  return {
    version: 1,
    jobKey: job.key || "",
    portal: job.portal || "",
    verdict,
    confidence,

    role,
    experience,
    location,
    workMode: mode,
    employmentType: employment,

    skills: {
      candidate: candidateSkillList,
      required: {
        all: requiredSkills,
        matched: required.matched,
        missing: required.missing,
        coverage: requiredCoverage
      },
      preferred: {
        all: preferredSkills,
        matched: preferred.matched,
        missing: preferred.missing
      }
    },

    blockers,
    strengths,
    gaps,
    review,

    explicitRequirements,
    explicitDisqualifiers,

    source: {
      aiEnriched: Boolean(job?.aiAnalysis),
      roleFamily: job?.aiAnalysis?.roleFamily || "",
      seniority: job?.aiAnalysis?.seniority || ""
    },

    evaluatedAt: new Date().toISOString()
  };
}
