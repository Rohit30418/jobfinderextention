// Validate each data model separately: e.g. profile.skills is an array,
// but capture.readiness.signals.skills is a count and job.sources.skills is a label.
export function validateBackup(payload) {
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const fail = path => { throw new Error("Invalid backup data at " + path + ". No data was imported."); };
  if (!object(payload) || payload.type !== "jobpilot-backup" || payload.version !== 1 || !object(payload.data)) fail("header/version");
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 20 * 1024 * 1024) fail("size (maximum 20 MB)");
  function walk(value, path, depth = 0) {
    if (depth > 25) fail(path);
    if (Array.isArray(value)) {
      if (value.length > 5000) fail(path);
      value.forEach((item, i) => walk(item, path + "[" + i + "]", depth + 1));
    } else if (object(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) fail(path + "." + key);
        walk(item, path + "." + key, depth + 1);
      }
    }
  }
  function strings(record, names, path) {
    for (const name of names) {
      if (record[name] != null && (!Array.isArray(record[name]) || record[name].some(item => typeof item !== "string"))) fail(path + "." + name);
    }
  }
  function textFields(record, names, path) {
    for (const name of names) if (record[name] != null && typeof record[name] !== "string") fail(path + "." + name);
  }
  function records(value, path, validator) {
    if (!object(value)) fail(path);
    for (const [key, row] of Object.entries(value)) {
      if (!object(row)) fail(path + "." + key);
      validator?.(row, path + "." + key);
    }
  }
  function job(row, path) {
    if (!object(row)) fail(path);
    textFields(row, ["key", "portal", "portalJobId", "canonicalUrl", "title", "company", "location", "description", "experienceText", "education"], path);
    strings(row, ["skills", "requiredSkills", "preferredSkills", "responsibilities", "requirementStatements", "preferredStatements"], path);
    for (const name of ["experienceMin", "experienceMax"]) {
      if (row[name] != null && (typeof row[name] !== "number" || !Number.isFinite(row[name]))) fail(path + "." + name);
    }
    if (row.detail != null) job(row.detail, path + ".detail");
    if (row.listing != null) job(row.listing, path + ".listing");
    // Derived analyses are invalidated during restore; do not trust imported candidate evidence.
  }
  function context(row, path) {
    if (!object(row)) fail(path);
    if (row.jobs != null) {
      if (!Array.isArray(row.jobs)) fail(path + ".jobs");
      row.jobs.forEach((item, i) => job(item, path + ".jobs[" + i + "]"));
    }
    if (row.detail != null) job(row.detail, path + ".detail");
  }
  function profile(row, path) {
    if (!object(row)) fail(path);
    strings(row, ["skills", "resumeKeywords", "targetRoles", "suggestedTargetRoles", "certifications"], path);
    for (const name of ["workExperience", "projects", "education"]) {
      if (row[name] == null) continue;
      if (!Array.isArray(row[name])) fail(path + "." + name);
      row[name].forEach((item, i) => {
        if (typeof item === "string") return;
        if (!object(item)) fail(path + "." + name + "[" + i + "]");
        strings(item, ["skillsUsed"], path + "." + name + "[" + i + "]");
      });
    }
    if (row.totalExperienceMonths != null && (typeof row.totalExperienceMonths !== "number" || !Number.isFinite(row.totalExperienceMonths) || row.totalExperienceMonths < 0)) fail(path + ".totalExperienceMonths");
  }
  for (const [key, value] of Object.entries(payload.data)) {
    if (!object(value)) fail(key);
    walk(value, key);
    if (key === "jobpilot.stage1.state" && value.profile != null) profile(value.profile, key + ".profile");
    if (key === "jobpilot.jobs.cache") records(value, key, job);
    if (key === "jobpilot.stage4.portalCapture" || key === "jobpilot.stage6.listingContext") context(value, key);
    if (key === "jobpilot.stage6.listingContexts") records(value.portals, key + ".portals", context);
    if (key === "jobpilot.skills.vault") records(value.items, key + ".items", (row, path) => {
      if (typeof row.skill !== "string") fail(path + ".skill");
      strings(row, ["sourceKeys", "portals"], path);
    });
    if (key === "jobpilot.jobs.applied") records(value.items, key + ".items", job);
    if (key === "jobpilot.insights.gapHistory") records(value, key, (row, path) => strings(row, ["missingRequired", "missingPreferred", "blockers", "gaps"], path));
    if (["jobpilot.stage2.preferences", "jobpilot.stage3.naukriSearch", "jobpilot.stage3.universalSearch", "jobpilot.stage3.naukriNativeFilters"].includes(key)) {
      strings(value, ["targetRoles", "priorityKeywords", "preferredLocations", "workModes", "employmentTypes", "excludedKeywords", "selectedPortals", "locations", "searchTerms", "cityTypeGids"], key);
    }
  }
  return true;
}
