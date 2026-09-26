(() => {
  if (globalThis.JobPilotRelevanceGate) return;

  const GENERIC_ROLE_WORDS = new Set([
    "developer","engineer","engineering","software","web","application","applications",
    "specialist","consultant","associate","senior","junior","lead","manager","analyst",
    "executive","officer","professional","expert","staff","principal","intern","trainee"
  ]);

  const NORMALIZATIONS = [
    [/front[ -]?end/g, "frontend"],
    [/back[ -]?end/g, "backend"],
    [/full[ -]?stack/g, "fullstack"],
    [/react\.?js/g, "react"],
    [/node\.?js/g, "node"],
    [/angular\.?js/g, "angular"],
    [/vue\.?js/g, "vue"],
    [/java\s*script/g, "javascript"],
    [/type\s*script/g, "typescript"],
    [/dot\s*net|\.net/g, "dotnet"]
  ];

  function clean(value) {
    let text = String(value || "").toLowerCase();
    for (const [pattern, replacement] of NORMALIZATIONS) {
      text = text.replace(pattern, replacement);
    }
    return text
      .replace(/[^a-z0-9+#.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function list(value) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    return String(value || "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function tokens(value) {
    return [...new Set(clean(value).split(" ").filter(Boolean))];
  }

  function roleDomainTokens(role) {
    return tokens(role).filter((token) => !GENERIC_ROLE_WORDS.has(token) && token.length > 1);
  }

  function includesPhrase(haystack, needle) {
    const h = " " + clean(haystack) + " ";
    const n = clean(needle);
    return Boolean(n) && h.includes(" " + n + " ");
  }

  function findMatches(haystack, needles) {
    return list(needles).filter((item) => includesPhrase(haystack, item));
  }

  function parsePostedDays(value) {
    const text = clean(value);
    if (!text) return null;
    if (/today|just now|few hours|hour ago|hours ago/.test(text)) return 0;

    let match = text.match(/(\d+)\s*day/);
    if (match) return Number(match[1]);

    match = text.match(/(\d+)\s*week/);
    if (match) return Number(match[1]) * 7;

    if (/30\+?\s*days/.test(text)) return 31;
    return null;
  }

  function freshnessLimit(value) {
    const map = {
      "24h": 1,
      "3d": 3,
      "7d": 7,
      "14d": 15,
      "30d": 30,
      "any": null
    };
    return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : null;
  }

  function experienceOverlaps(job, prefs) {
    const jobMin = Number.isFinite(job.experienceMin) ? job.experienceMin : null;
    const jobMax = Number.isFinite(job.experienceMax) ? job.experienceMax : null;
    const prefMin = Number.isFinite(prefs.experienceMin) ? prefs.experienceMin : null;
    const prefMax = Number.isFinite(prefs.experienceMax) ? prefs.experienceMax : null;

    if (jobMin === null && jobMax === null) return null;
    if (prefMin === null && prefMax === null) return null;

    const aMin = jobMin ?? 0;
    const aMax = jobMax ?? 99;
    const bMin = prefMin ?? 0;
    const bMax = prefMax ?? 99;

    return aMin <= bMax && bMin <= aMax;
  }

  function locationCompatible(job, prefs) {
    const preferred = list(prefs.preferredLocations);
    if (!preferred.length || !job.location) return null;

    const jobLocation = clean(job.location);
    return preferred.some((location) => jobLocation.includes(clean(location)));
  }

  function detectRoleConflict(titleValue, targetRoles, priorityKeywords) {
    const titleText = clean(titleValue);
    const targetText = clean([...(targetRoles || []), ...(priorityKeywords || [])].join(" "));
    const titleTokenSet = new Set(tokens(titleText));

    const wantsFrontend =
      /\bfrontend\b|\breact\b|\bjavascript\b|\btypescript\b|\bui\b/.test(targetText);

    if (!wantsFrontend) return null;

    const frontendEvidence =
      /\bfrontend\b|\breact\b|\bjavascript\b|\btypescript\b|\bui\b|\bnext\b/.test(titleText);

    const fullstackEvidence = /\bfullstack\b/.test(titleText);

    const incompatible = [
      ["java", "Java"],
      ["spring", "Spring"],
      ["android", "Android"],
      ["dotnet", ".NET"],
      ["c#", "C#"],
      ["php", "PHP"],
      ["laravel", "Laravel"],
      ["python", "Python"],
      ["django", "Django"],
      ["devops", "DevOps"],
      ["data", "Data"],
      ["qa", "QA"],
      ["tester", "Testing"]
    ];

    const hits = incompatible
      .filter(([token]) => titleTokenSet.has(token))
      .map(([, label]) => label);

    const backendOnly =
      titleTokenSet.has("backend") &&
      !frontendEvidence &&
      !fullstackEvidence;

    if (backendOnly) hits.push("Backend");

    if (!hits.length) return null;

    // A mixed title such as "Java + React Fullstack Developer" should be
    // reviewed, not automatically discarded.
    if (frontendEvidence || fullstackEvidence) {
      return {
        severity: "review",
        hits: [...new Set(hits)]
      };
    }

    return {
      severity: "filtered",
      hits: [...new Set(hits)]
    };
  }

  function evaluate(job, preferences = {}) {
    const targetRoles = list(preferences.targetRoles);
    const priorityKeywords = list(preferences.priorityKeywords);
    const excludedKeywords = list(preferences.excludedKeywords);

    const title = clean(job.title);
    const skills = clean((job.skills || []).join(" "));
    const snippet = clean(job.snippet || job.description || "");
    const combined = [title, skills, snippet].filter(Boolean).join(" ");

    const excludedTitleHits = findMatches(title, excludedKeywords);
    const excludedAnyHits = findMatches(combined, excludedKeywords);

    if (excludedTitleHits.length && preferences.hideExcludedTitles !== false) {
      return {
        status: "filtered",
        reasonCode: "excluded-title",
        reasons: ["Excluded title keyword: " + excludedTitleHits.join(", ")],
        signals: { excludedTitleHits, excludedAnyHits }
      };
    }

    const exactRoleHits = targetRoles.filter((role) => includesPhrase(title, role));
    const targetDomain = [...new Set(targetRoles.flatMap(roleDomainTokens))];
    const titleTokens = new Set(tokens(title));
    const roleTokenHits = targetDomain.filter((token) => titleTokens.has(token));

    const priorityTitleHits = findMatches(title, priorityKeywords);
    const priorityAnyHits = findMatches(combined, priorityKeywords);

    const hasSpecificRoleIntent = targetDomain.length > 0;
    const roleSignalStrong =
      exactRoleHits.length > 0 ||
      roleTokenHits.length > 0 ||
      priorityTitleHits.length > 0;

    const roleSignalWeak =
      priorityAnyHits.length > 0;

    const roleConflict = detectRoleConflict(
      job.title,
      targetRoles,
      priorityKeywords
    );

    const exp = experienceOverlaps(job, preferences);
    const location = locationCompatible(job, preferences);
    const postedDays = parsePostedDays(job.postedAge);
    const maxDays = freshnessLimit(preferences.freshness);
    const freshnessOkay =
      postedDays === null || maxDays === null
        ? null
        : postedDays <= maxDays;

    const reasons = [];

    if (exactRoleHits.length) reasons.push("Target role phrase matched");
    else if (roleTokenHits.length) reasons.push("Role-family token matched: " + roleTokenHits.join(", "));
    else if (priorityTitleHits.length) reasons.push("Priority keyword matched in title: " + priorityTitleHits.join(", "));
    else if (priorityAnyHits.length) reasons.push("Priority keyword matched only in skills/snippet: " + priorityAnyHits.join(", "));

    if (exp === true) reasons.push("Experience range overlaps");
    if (exp === false) reasons.push("Experience range does not overlap");

    if (location === true) reasons.push("Preferred location matched");
    if (location === false) reasons.push("Preferred location not matched");

    if (freshnessOkay === true) reasons.push("Freshness is within preference");
    if (freshnessOkay === false) reasons.push("Job is older than preferred freshness");

    if (excludedAnyHits.length && !excludedTitleHits.length) {
      reasons.push("Excluded keyword appears outside title: " + excludedAnyHits.join(", "));
    }

    if (roleConflict?.severity === "filtered") {
      return {
        status: "filtered",
        reasonCode: "role-family-conflict",
        reasons: [
          "Role-family conflict in title: " + roleConflict.hits.join(", ")
        ],
        signals: {
          exactRoleHits,
          roleTokenHits,
          priorityTitleHits,
          priorityAnyHits,
          roleConflict,
          exp,
          location,
          freshnessOkay
        }
      };
    }

    if (
      roleConflict?.severity === "review" &&
      exactRoleHits.length === 0
    ) {
      reasons.push(
        "Mixed role-family title needs review: " +
        roleConflict.hits.join(", ")
      );
    }

    if (preferences.strictExperience === true && exp === false) {
      return {
        status: "filtered",
        reasonCode: "experience-mismatch",
        reasons,
        signals: { exactRoleHits, roleTokenHits, priorityTitleHits, priorityAnyHits, exp, location, freshnessOkay }
      };
    }

    if (preferences.strictFreshness !== false && freshnessOkay === false) {
      return {
        status: "filtered",
        reasonCode: "stale",
        reasons,
        signals: { exactRoleHits, roleTokenHits, priorityTitleHits, priorityAnyHits, exp, location, freshnessOkay }
      };
    }

    if (hasSpecificRoleIntent && !roleSignalStrong) {
      return {
        status: roleSignalWeak ? "review" : "filtered",
        reasonCode: roleSignalWeak ? "weak-role-signal" : "role-mismatch",
        reasons: reasons.length ? reasons : ["No target-role signal found in the job title"],
        signals: { exactRoleHits, roleTokenHits, priorityTitleHits, priorityAnyHits, exp, location, freshnessOkay }
      };
    }

    if (roleSignalStrong && roleConflict?.severity !== "review") {
      return {
        status: "relevant",
        reasonCode: "role-match",
        reasons,
        signals: { exactRoleHits, roleTokenHits, priorityTitleHits, priorityAnyHits, exp, location, freshnessOkay }
      };
    }

    if (!hasSpecificRoleIntent && priorityAnyHits.length) {
      return {
        status: "relevant",
        reasonCode: "keyword-match",
        reasons,
        signals: { exactRoleHits, roleTokenHits, priorityTitleHits, priorityAnyHits, exp, location, freshnessOkay }
      };
    }

    return {
      status: "review",
      reasonCode: "insufficient-signal",
      reasons: reasons.length ? reasons : ["Not enough evidence for a quick relevance decision"],
      signals: { exactRoleHits, roleTokenHits, priorityTitleHits, priorityAnyHits, exp, location, freshnessOkay }
    };
  }

  function annotateJobs(jobs, preferences) {
    const annotated = (Array.isArray(jobs) ? jobs : []).map((job) => ({
      ...job,
      relevance: evaluate(job, preferences)
    }));

    return {
      jobs: annotated,
      stats: {
        relevant: annotated.filter((job) => job.relevance.status === "relevant").length,
        review: annotated.filter((job) => job.relevance.status === "review").length,
        filtered: annotated.filter((job) => job.relevance.status === "filtered").length
      }
    };
  }

  globalThis.JobPilotRelevanceGate = {
    evaluate,
    annotateJobs,
    clean,
    roleDomainTokens,
    detectRoleConflict
  };
})();
