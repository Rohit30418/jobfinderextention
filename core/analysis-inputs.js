// Stable, content-based revision; timestamps and prior analysis are intentionally excluded.
export function analysisRevision(profile, preferences, job) {
  const fields = ["key", "portal", "portalJobId", "canonicalUrl", "title", "company", "location", "experienceText", "experienceMin", "experienceMax", "salaryText", "skills", "description", "snippet", "requiredSkills", "preferredSkills", "responsibilities", "requirementStatements", "preferredStatements", "education", "employmentType", "workMode", "datePosted", "postedAge"];
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().filter(key => key !== "updatedAt").map(key => [key, stable(value[key])])) : value;
  const text = JSON.stringify(stable([profile, preferences, Object.fromEntries(fields.map(key => [key, job?.[key] ?? null]))]));
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return "v2:" + (a >>> 0).toString(16) + ":" + (b >>> 0).toString(16) + ":" + text.length;
}
