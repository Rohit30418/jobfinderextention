(() => {
  if (globalThis.JobPilotPortalEngine) return;

  const adapters = [];

  function clean(value, max = 10000) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/[\t\r]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .replace(/ {2,}/g, " ")
      .trim()
      .slice(0, max);
  }

  function unique(values, max = 50) {
    const output = [];
    const seen = new Set();

    for (const item of values || []) {
      const value = clean(item, 300);
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(value);
      if (output.length >= max) break;
    }

    return output;
  }

  function absoluteUrl(value) {
    try {
      return new URL(value, location.href).href;
    } catch (_) {
      return "";
    }
  }

  function hashString(value) {
    let hash = 2166136261;
    const source = String(value || "");

    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(36);
  }

  function parseExperience(text) {
    const value = clean(text, 200);
    const range = value.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s*(?:yrs?|years?)/i);
    if (range) {
      return {
        text: value,
        min: Number(range[1]),
        max: Number(range[2])
      };
    }

    const single = value.match(/(\d+)\+?\s*(?:yrs?|years?)/i);
    if (single) {
      return {
        text: value,
        min: Number(single[1]),
        max: null
      };
    }

    const monthsRange = value.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s*months?/i);
    if (monthsRange) {
      return {
        text: value,
        min: Math.round((Number(monthsRange[1]) / 12) * 10) / 10,
        max: Math.round((Number(monthsRange[2]) / 12) * 10) / 10
      };
    }

    const months = value.match(/(\d+)\s*months?/i);
    if (months) {
      const years = Math.round((Number(months[1]) / 12) * 10) / 10;
      return {
        text: value + " (" + years + " years)",
        min: years,
        max: years
      };
    }

    return { text: value, min: null, max: null };
  }

  function confidence(job, pageType) {
    const weights = pageType === "detail"
      ? {
          title: 14,
          company: 12,
          canonicalUrl: 10,
          description: 18,
          experienceText: 10,
          location: 8,
          salaryText: 6,
          skills: 10,
          datePosted: 6,
          employmentType: 3,
          education: 3
        }
      : {
          title: 18,
          company: 14,
          canonicalUrl: 14,
          experienceText: 12,
          location: 10,
          postedAge: 8,
          skills: 10,
          snippet: 8,
          salaryText: 6
        };

    let score = 0;
    const missing = [];

    for (const [field, weight] of Object.entries(weights)) {
      const value = job[field];
      const present = Array.isArray(value) ? value.length > 0 : Boolean(clean(value, 50000));

      if (present) score += weight;
      else missing.push(field);
    }

    return {
      score,
      level: score >= 75 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW",
      missing
    };
  }

  function makeKey(portal, portalJobId, canonicalUrl, title, company) {
    if (portalJobId) return portal + ":" + portalJobId;

    const basis = [
      portal,
      canonicalUrl,
      title,
      company
    ].filter(Boolean).join("|");

    return portal + ":hash:" + hashString(basis);
  }

  function normalizeJob(raw, context = {}) {
    const source = raw && typeof raw === "object" ? raw : {};
    const portal = clean(context.portal || source.portal || "unknown", 40).toLowerCase();
    const pageType = context.pageType === "detail" ? "detail" : "listing";
    const canonicalUrl = absoluteUrl(
      source.canonicalUrl ||
      source.jobUrl ||
      source.url ||
      location.href
    );

    const experience = parseExperience(source.experienceText || source.experience || "");
    const portalJobId = clean(source.portalJobId || source.jobId || "", 160);
    const title = clean(source.title, 300);
    const company = clean(source.company, 300);
    const skills = unique(source.skills || [], 40);

    const normalized = {
      key: makeKey(portal, portalJobId, canonicalUrl, title, company),
      portal,
      portalJobId,
      canonicalUrl,

      title,
      company,
      location: clean(source.location, 500),
      experienceText: experience.text,
      experienceMin: experience.min,
      experienceMax: experience.max,
      salaryText: clean(source.salaryText || source.salary, 300),
      skills,

      snippet: clean(source.snippet || source.descriptionSnippet, 1200),
      postedAge: clean(source.postedAge, 180),
      datePosted: clean(source.datePosted, 180),

      description: clean(source.description, 30000),
      responsibilities: unique(source.responsibilities || [], 40),
      requiredSkills: unique(source.requiredSkills || [], 40),
      preferredSkills: unique(source.preferredSkills || [], 40),
      requirementStatements: unique(source.requirementStatements || [], 40),
      preferredStatements: unique(source.preferredStatements || [], 30),
      education: clean(source.education, 1000),
      employmentType: clean(source.employmentType, 250),
      workMode: clean(source.workMode, 180),

      listing: pageType === "listing"
        ? {
            title,
            company,
            location: clean(source.location, 500),
            experienceText: experience.text,
            salaryText: clean(source.salaryText || source.salary, 300),
            skills,
            snippet: clean(source.snippet || source.descriptionSnippet, 1200),
            postedAge: clean(source.postedAge, 180)
          }
        : null,

      detail: pageType === "detail"
        ? {
            description: clean(source.description, 30000),
            responsibilities: unique(source.responsibilities || [], 40),
            requiredSkills: unique(source.requiredSkills || [], 40),
            preferredSkills: unique(source.preferredSkills || [], 40),
            requirementStatements: unique(source.requirementStatements || [], 40),
            preferredStatements: unique(source.preferredStatements || [], 30),
            education: clean(source.education, 1000),
            employmentType: clean(source.employmentType, 250),
            workMode: clean(source.workMode, 180),
            datePosted: clean(source.datePosted, 180)
          }
        : null,

      extraction: {
        pageType,
        method: clean(context.method || source.captureMethod || "unknown", 80),
        adapterVersion: clean(context.adapterVersion || "1", 30),
        confidence: null
      },

      status: {
        detailLoaded: pageType === "detail",
        expired: Boolean(source.expired)
      },

      sources: source.sources && typeof source.sources === "object"
        ? source.sources
        : {},

      capturedAt: new Date().toISOString()
    };

    normalized.extraction.confidence = confidence(normalized, pageType);
    return normalized;
  }

  function mergeJob(existing, incoming) {
    if (!existing) return incoming;
    if (!incoming) return existing;

    const next = {
      ...existing,
      ...incoming,
      listing: incoming.listing || existing.listing || null,
      detail: incoming.detail || existing.detail || null,
      status: {
        ...(existing.status || {}),
        ...(incoming.status || {}),
        detailLoaded: Boolean(
          incoming.status?.detailLoaded ||
          existing.status?.detailLoaded
        )
      },
      sources: {
        ...(existing.sources || {}),
        ...(incoming.sources || {})
      },
      capturedAt: incoming.capturedAt || existing.capturedAt
    };

    for (const field of [
      "title",
      "company",
      "location",
      "experienceText",
      "salaryText",
      "snippet",
      "postedAge",
      "datePosted",
      "description",
      "education",
      "employmentType",
      "workMode",
      "canonicalUrl",
      "portalJobId"
    ]) {
      if (!clean(next[field], 50000)) {
        next[field] = clean(existing[field], 50000);
      }
    }

    for (const field of [
      "skills",
      "responsibilities",
      "requiredSkills",
      "preferredSkills",
      "requirementStatements",
      "preferredStatements"
    ]) {
      next[field] = unique([
        ...(existing[field] || []),
        ...(incoming[field] || [])
      ], 50);
    }

    return next;
  }

  function registerAdapter(adapter) {
    if (!adapter || !adapter.id || typeof adapter.matches !== "function") {
      throw new Error("Invalid JobPilot portal adapter.");
    }

    if (adapters.some((item) => item.id === adapter.id)) return;
    adapters.push(adapter);
  }

  function detectAdapter(url = location.href) {
    return adapters.find((adapter) => {
      try {
        return adapter.matches(url);
      } catch (_) {
        return false;
      }
    }) || null;
  }

  globalThis.JobPilotPortalEngine = {
    registerAdapter,
    detectAdapter,
    normalizeJob,
    mergeJob,
    clean,
    unique,
    absoluteUrl,
    hashString,
    confidence,
    adapters
  };
})();
