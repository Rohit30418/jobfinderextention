(() => {
  if (globalThis.JobPilotNaukriDetail) return;

  const engine = globalThis.JobPilotPortalEngine;

  function textOf(root, selectors, max = 1000) {
    for (const selector of selectors) {
      let node = null;
      try { node = root.querySelector(selector); } catch (_) {}
      const value = engine.clean(node?.textContent || node?.innerText || "", max);
      if (value) return value;
    }
    return "";
  }

  function allTexts(root, selectors, limit = 50) {
    const output = [];

    for (const selector of selectors) {
      let nodes = [];
      try { nodes = Array.from(root.querySelectorAll(selector)); } catch (_) {}

      for (const node of nodes) {
        const value = engine.clean(node.textContent || node.innerText || "", 240);
        if (!value || value.length > 160) continue;
        if (!output.includes(value)) output.push(value);
        if (output.length >= limit) return output;
      }
    }

    return output;
  }

  function jsonLdJob() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent || "null");
        const queue = Array.isArray(parsed) ? [...parsed] : [parsed];

        while (queue.length) {
          const item = queue.shift();
          if (!item || typeof item !== "object") continue;

          const type = item["@type"];
          if (
            type === "JobPosting" ||
            (Array.isArray(type) && type.includes("JobPosting"))
          ) {
            return item;
          }

          if (Array.isArray(item["@graph"])) queue.push(...item["@graph"]);
        }
      } catch (_) {}
    }

    return null;
  }

  function stripHtml(value) {
    if (!value) return "";

    try {
      const doc = new DOMParser().parseFromString(String(value), "text/html");

      // Preserve useful section/bullet boundaries before normalization.
      doc.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
      doc.querySelectorAll("li").forEach((node) => {
        node.insertAdjacentText("afterbegin", "• ");
        node.insertAdjacentText("beforeend", "\n");
      });
      doc.querySelectorAll("p,h1,h2,h3,h4,h5,h6,div").forEach((node) => {
        node.insertAdjacentText("beforeend", "\n");
      });

      return engine.clean(
        doc.body?.innerText || doc.body?.textContent || "",
        30000
      );
    } catch (_) {
      return engine.clean(String(value).replace(/<[^>]+>/g, " "), 30000);
    }
  }

  function jsonLocation(value) {
    const items = Array.isArray(value) ? value : value ? [value] : [];
    const output = [];

    for (const item of items) {
      const address = item?.address || item;
      if (!address || typeof address !== "object") continue;

      const pieces = engine.unique([
        address.addressLocality,
        address.addressRegion,
        address.addressCountry?.name || address.addressCountry
      ], 6).filter((item) => !/^[-–—]+$/.test(item));

      const text = pieces.join(", ");
      if (text) output.push(text);
    }

    return engine.unique(output, 10).join(" | ");
  }

  function jsonSalary(baseSalary) {
    if (!baseSalary) return "";
    if (typeof baseSalary === "string") return engine.clean(baseSalary, 300);

    const currency = engine.clean(baseSalary.currency, 30);
    const value = baseSalary.value;

    if (value && typeof value === "object") {
      const min = value.minValue ?? "";
      const max = value.maxValue ?? "";
      const unit = value.unitText || "";
      const numbers =
        min !== "" && max !== ""
          ? min + " - " + max
          : String(min || max || "");

      return engine.clean([currency, numbers, unit].filter(Boolean).join(" "), 300);
    }

    return engine.clean([currency, value].filter(Boolean).join(" "), 300);
  }

  function identifierFromUrl(url) {
    const digits = String(url || "").match(/\d{7,}/g);
    return digits?.[digits.length - 1] || "";
  }

  function meaningfulLocation(value) {
    const text = engine.clean(value, 500);
    if (!text) return false;
    if (/^[-–—,\s]+$/.test(text)) return false;
    return /[a-z]/i.test(text);
  }

  function meaningfulSalary(value) {
    const text = engine.clean(value, 300);
    if (!text) return false;

    // Prefer salary strings containing an amount/range over "INR P.A.".
    return /\d/.test(text) || /not disclosed/i.test(text);
  }

  function chooseBetter(primary, fallback, validator) {
    const first = engine.clean(primary, 30000);
    const second = engine.clean(fallback, 30000);

    if (validator(first)) return first;
    if (validator(second)) return second;
    return first || second;
  }

  function linesFromDescription(description) {
    return String(description || "")
      .split(/\n+/)
      .map((line) =>
        engine.clean(
          line
            .replace(/^[•●▪◦*\-–—]+\s*/, "")
            .replace(/^\d+[.)]\s*/, ""),
          1200
        )
      )
      .filter(Boolean);
  }

  function likelySentenceItems(description) {
    const lines = linesFromDescription(description);
    const output = [];

    for (const line of lines) {
      if (line.length < 12 || line.length > 700) continue;

      const pieces = line
        .split(/(?<=[.!?;])\s+(?=[A-Z0-9])/)
        .map((piece) => engine.clean(piece, 700))
        .filter((piece) => piece.length >= 12);

      output.push(...pieces);
    }

    return engine.unique(output, 100);
  }

  function extractResponsibilities(description) {
    const items = likelySentenceItems(description);

    const actionPattern =
      /\b(develop|build|design|implement|maintain|create|collaborate|work with|integrate|optimi[sz]e|debug|test|review|deliver|manage|lead|support|write|participate|ensure|own|architect|troubleshoot|deploy)\b/i;

    return engine.unique(
      items.filter((item) =>
        actionPattern.test(item) &&
        !/\b(required|must have|should have|qualification|candidate should|experience in|proficien|knowledge of)\b/i.test(item)
      ),
      25
    );
  }

  function extractRequirementStatements(description) {
    const items = likelySentenceItems(description);

    return engine.unique(
      items.filter((item) =>
        /\b(required|must have|must possess|should have|required skills?|requirements?|qualification|candidate should|minimum .* years?|experience (?:in|with)|proficien(?:t|cy)|strong knowledge|hands[- ]on|expertise in)\b/i.test(item)
      ),
      30
    );
  }

  function extractPreferredStatements(description) {
    const items = likelySentenceItems(description);

    return engine.unique(
      items.filter((item) =>
        /\b(preferred|good to have|nice to have|plus|advantage|desirable)\b/i.test(item)
      ),
      20
    );
  }

  function skillsMentionedInStatements(skills, statements) {
    const haystack = statements.join(" ").toLowerCase();

    return engine.unique(
      (skills || []).filter((skill) => {
        const value = engine.clean(skill, 100).toLowerCase();
        return value.length >= 2 && haystack.includes(value);
      }),
      30
    );
  }

  function inferWorkMode(description, locationText) {
    const text = (description + " " + locationText).toLowerCase();

    if (/\bhybrid\b/.test(text)) return "Hybrid";
    if (/\bwork from home\b|\bremote\b|\bwfh\b/.test(text)) return "Remote";
    if (/\bwork from office\b|\bon[- ]site\b|\bonsite\b/.test(text)) return "On-site";
    return "";
  }

  function educationFromDescription(description) {
    const lines = likelySentenceItems(description);

    const matches = lines.filter((item) =>
      /\b(b\.?e\.?|b\.?tech|m\.?tech|bachelor|master|degree|bca|mca|bsc|msc|computer science|engineering graduate|graduate degree)\b/i.test(item)
    );

    return engine.unique(matches, 8).join(" | ");
  }

  function detect() {
    return location.pathname.toLowerCase().includes("job-listings-");
  }

  function capture() {
    const json = jsonLdJob();

    const dom = {
      title: textOf(document, [
        ".jd-header-title",
        "[class*='jd-header-title']",
        "h1"
      ], 350),

      company: textOf(document, [
        ".jd-header-comp-name",
        ".jd-header-comp-name a",
        "[class*='comp-name']",
        "[class*='company-name']"
      ], 300),

      experienceText: textOf(document, [
        ".exp",
        "[class*='experience']",
        "[class*='exp-wrap']",
        "[class*='expwdth']"
      ], 250),

      location: textOf(document, [
        ".loc",
        "[class*='location']",
        "[class*='loc-wrap']",
        "[class*='locWdth']"
      ], 500),

      salaryText: textOf(document, [
        ".salary",
        "[class*='salary']",
        "[class*='sal-wrap']",
        ".sal"
      ], 300),

      description: textOf(document, [
        ".dang-inner-html",
        ".jobDescription",
        "[class*='jobDescription']",
        "[class*='job-desc']"
      ], 30000),

      skills: engine.unique(
        allTexts(document, [
          ".key-skill .chip",
          ".key-skill a",
          "[class*='key-skill'] a",
          "[class*='key-skill'] li",
          "[class*='skills'] li",
          "[class*='skills'] a"
        ], 50),
        50
      ),

      postedAge: textOf(document, [
        ".jd-stats",
        "[class*='jd-stats']",
        "[class*='posted']",
        "[class*='post-day']"
      ], 300),

      employmentType: textOf(document, [
        "[class*='employment']",
        "[class*='job-type']"
      ], 250)
    };

    const jsonSkills = engine.unique(
      Array.isArray(json?.skills)
        ? json.skills
        : String(json?.skills || json?.qualifications || "").split(/[,;|]/),
      50
    );

    const allSkills = engine.unique(
      [...jsonSkills, ...dom.skills],
      50
    );

    const jsonDescription = stripHtml(json?.description);
    const fullDescription = jsonDescription || dom.description;

    const jsonLocationText = jsonLocation(json?.jobLocation);
    const finalLocation = chooseBetter(
      jsonLocationText,
      dom.location,
      meaningfulLocation
    );

    const jsonSalaryText = jsonSalary(json?.baseSalary);
    const finalSalary = chooseBetter(
      jsonSalaryText,
      dom.salaryText,
      meaningfulSalary
    );

    const canonicalUrl = engine.absoluteUrl(json?.url || location.href);
    const identifier =
      engine.clean(json?.identifier?.value, 160) ||
      identifierFromUrl(canonicalUrl);

    const requirementStatements = extractRequirementStatements(fullDescription);
    const preferredStatements = extractPreferredStatements(fullDescription);
    const responsibilities = extractResponsibilities(fullDescription);

    const requiredSkills = skillsMentionedInStatements(
      allSkills,
      requirementStatements
    );

    const preferredSkills = skillsMentionedInStatements(
      allSkills,
      preferredStatements
    );

    const explicitEducation =
      engine.clean(
        typeof json?.educationRequirements === "string"
          ? json.educationRequirements
          : json?.educationRequirements?.credentialCategory ||
            json?.educationRequirements?.name ||
            "",
        1000
      );

    const education = explicitEducation || educationFromDescription(fullDescription);

    const employmentType = Array.isArray(json?.employmentType)
      ? json.employmentType.join(", ")
      : engine.clean(json?.employmentType, 250) || dom.employmentType;

    const workMode = inferWorkMode(fullDescription, finalLocation);

    const jsonExperience =
      engine.clean(
        typeof json?.experienceRequirements === "string"
          ? json.experienceRequirements
          : json?.experienceRequirements?.monthsOfExperience
            ? json.experienceRequirements.monthsOfExperience + " months"
            : "",
        300
      );

    const job = {
      portalJobId: identifier,
      canonicalUrl,

      title: engine.clean(json?.title, 350) || dom.title,
      company: engine.clean(json?.hiringOrganization?.name, 300) || dom.company,
      experienceText: jsonExperience || dom.experienceText,
      location: finalLocation,
      salaryText: finalSalary,

      skills: allSkills,
      description: fullDescription,
      responsibilities,
      requiredSkills,
      preferredSkills,

      requirementStatements,
      preferredStatements,

      postedAge: dom.postedAge,
      datePosted: engine.clean(json?.datePosted, 180),
      employmentType,
      education,
      workMode,

      captureMethod: json ? "json-ld+detail-dom" : "detail-dom",

      sources: {
        title: json?.title ? "json-ld" : dom.title ? "detail-dom" : "",
        company: json?.hiringOrganization?.name ? "json-ld" : dom.company ? "detail-dom" : "",
        experienceText: jsonExperience ? "json-ld" : dom.experienceText ? "detail-dom" : "",
        location:
          meaningfulLocation(jsonLocationText) ? "json-ld" :
          meaningfulLocation(dom.location) ? "detail-dom" : "",
        salaryText:
          meaningfulSalary(jsonSalaryText) ? "json-ld" :
          meaningfulSalary(dom.salaryText) ? "detail-dom" : "",
        skills:
          jsonSkills.length && dom.skills.length ? "json-ld+detail-dom" :
          jsonSkills.length ? "json-ld" :
          dom.skills.length ? "detail-dom" : "",
        description: jsonDescription ? "json-ld" : dom.description ? "detail-dom" : "",
        responsibilities: responsibilities.length ? "jd-parser" : "",
        requiredSkills: requiredSkills.length ? "jd-parser" : "",
        preferredSkills: preferredSkills.length ? "jd-parser" : "",
        education:
          explicitEducation ? "json-ld" :
          education ? "jd-parser" : "",
        employmentType:
          json?.employmentType ? "json-ld" :
          dom.employmentType ? "detail-dom" : "",
        workMode: workMode ? "jd-parser" : "",
        datePosted: json?.datePosted ? "json-ld" : "",
        postedAge: dom.postedAge ? "detail-dom" : "",
        portalJobId:
          json?.identifier?.value ? "json-ld" :
          identifier ? "url" : ""
      }
    };

    const readinessSignals = {
      title: Boolean(job.title),
      company: Boolean(job.company),
      description: job.description.length >= 80,
      experience: Boolean(job.experienceText),
      location: Boolean(job.location),
      skills: job.skills.length > 0,
      posted: Boolean(job.datePosted || job.postedAge)
    };

    const secondaryReady = [
      readinessSignals.company,
      readinessSignals.experience,
      readinessSignals.location,
      readinessSignals.skills,
      readinessSignals.posted
    ].filter(Boolean).length;

    const ready =
      readinessSignals.title &&
      readinessSignals.description &&
      secondaryReady >= 2;

    return {
      method: json ? "json-ld+detail-dom" : "detail-dom",
      job,
      readiness: {
        ready,
        secondaryReady,
        signals: readinessSignals,
        reason: ready
          ? "detail-ready"
          : !readinessSignals.title
            ? "waiting-for-title"
            : !readinessSignals.description
              ? "waiting-for-description"
              : "waiting-for-core-fields"
      }
    };
  }

  globalThis.JobPilotNaukriDetail = {
    detect,
    capture,
    version: "2"
  };
})();
