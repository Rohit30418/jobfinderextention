// Validate before touching storage. Backups are untrusted input, including old exports.
export function validateBackup(payload) {
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const fail = path => { throw new Error("Invalid backup data at " + path + ". No data was imported."); };
  if (!object(payload) || payload.type !== "jobpilot-backup" || payload.version !== 1 || !object(payload.data)) fail("header/version");
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 20 * 1024 * 1024) fail("size (maximum 20 MB)");
  const arrays = new Set(["skills", "skillsUsed", "resumeKeywords", "targetRoles", "suggestedTargetRoles", "projects", "workExperience", "certifications", "jobs", "cards", "requiredSkills", "preferredSkills", "responsibilities", "requirementStatements", "preferredStatements", "sourceKeys", "portals", "priorityKeywords", "preferredLocations", "workModes", "employmentTypes", "excludedKeywords", "selectedPortals", "locations", "searchTerms", "cityTypeGids", "candidateRequirementMatches", "blockers", "gaps", "missingRequired", "missingPreferred"]);
  const strings = new Set(["skills", "skillsUsed", "resumeKeywords", "targetRoles", "suggestedTargetRoles", "certifications", "requiredSkills", "preferredSkills", "responsibilities", "requirementStatements", "preferredStatements", "sourceKeys", "priorityKeywords", "preferredLocations", "workModes", "employmentTypes", "excludedKeywords", "selectedPortals", "locations", "searchTerms", "cityTypeGids", "missingRequired", "missingPreferred"]);
  function walk(value, path, depth = 0) {
    if (depth > 25) fail(path);
    if (Array.isArray(value)) {
      if (value.length > 5000) fail(path);
      value.forEach((item, i) => walk(item, path + "[" + i + "]", depth + 1));
    } else if (object(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) fail(path + "." + key);
        // Contexts.portals is a dictionary; skill records.portals is an array.
        if (key === "education" && path.endsWith(".profile") && item != null && !Array.isArray(item)) fail(path + ".education");
        if (arrays.has(key) && item != null && !((key === "portals" || (key === "skills" && path.endsWith(".deepMatch"))) && object(item)) && !Array.isArray(item)) fail(path + "." + key);
        if (strings.has(key) && Array.isArray(item) && item.some(x => typeof x !== "string")) fail(path + "." + key);
        if (key === "totalExperienceMonths" && item != null && (typeof item !== "number" || !Number.isFinite(item) || item < 0)) fail(path + "." + key);
        walk(item, path + "." + key, depth + 1);
      }
    }
  }
  for (const [key, value] of Object.entries(payload.data)) {
    if (!object(value)) fail(key);
    if (key.endsWith(".state") && value.profile != null && !object(value.profile)) fail(key + ".profile");
    if ((key.endsWith(".vault") || key.endsWith(".applied")) && !object(value.items)) fail(key + ".items");
    const maps = key.endsWith(".cache") || key.endsWith(".gapHistory") ? [value]
      : key.endsWith(".vault") || key.endsWith(".applied") ? [value.items]
      : key.endsWith(".listingContexts") ? [value.portals] : [];
    for (const map of maps) {
      if (!object(map) || Object.values(map).some(item => !object(item))) fail(key + ".records");
    }
    walk(value, key);
  }
  return true;
}
