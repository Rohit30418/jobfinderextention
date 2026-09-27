function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(cleanString).filter(Boolean))];
}

function cleanObjects(value, keys) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const source = item && typeof item === "object" ? item : {};
      const next = {};
      keys.forEach((key) => {
        if (Array.isArray(source[key])) {
          next[key] = cleanArray(source[key]);
        } else {
          next[key] = cleanString(source[key]);
        }
      });
      return next;
    })
    .filter((item) =>
      Object.values(item).some((value) => (Array.isArray(value) ? value.length : value))
    );
}

export function normalizeAiProfile(value) {
  const source = value && typeof value === "object" ? value : {};
  const totalExperienceMonths = source.totalExperienceMonths != null && source.totalExperienceMonths !== "" && Number.isFinite(Number(source.totalExperienceMonths))
    ? Math.max(0, Math.round(Number(source.totalExperienceMonths)))
    : null;

  return {
    name: cleanString(source.name),
    headline: cleanString(source.headline),
    currentRole: cleanString(source.currentRole),
    totalExperienceMonths,
    skills: cleanArray(source.skills),
    workExperience: cleanObjects(source.workExperience, [
      "company", "title", "startDate", "endDate", "description", "skillsUsed"
    ]),
    education: cleanObjects(source.education, [
      "qualification", "institution", "year", "details"
    ]),
    projects: cleanObjects(source.projects, [
      "name", "description", "skillsUsed"
    ]),
    certifications: cleanArray(source.certifications),
    suggestedTargetRoles: cleanArray(source.suggestedTargetRoles),
    resumeKeywords: cleanArray(source.resumeKeywords)
  };
}

export function splitList(value) {
  return [...new Set(
    String(value || "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

export function lines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function profileFromForm(form) {
  const years = Math.max(0, Number(form.experienceYears || 0));
  const months = Math.max(0, Math.min(11, Number(form.experienceMonths || 0)));

  return {
    name: cleanString(form.name),
    headline: cleanString(form.headline),
    currentRole: cleanString(form.currentRole),
    totalExperienceMonths: form.experienceYears === "" && form.experienceMonths === "" ? null : Math.round(years * 12 + months),
    workExperience: Array.isArray(form.originalProfile?.workExperience) ? form.originalProfile.workExperience : [],
    skills: splitList(form.skills),
    targetRoles: splitList(form.targetRoles),
    education: lines(form.education),
    certifications: lines(form.certifications),
    projects: lines(form.projects).map(line => (form.originalProfile?.projects || []).find(item =>
      typeof item === "object" && [item.name, item.description].filter(Boolean).join(" — ") === line
    ) || line),
    resumeKeywords: splitList(form.resumeKeywords),
    source: form.source || "manual"
  };
}
