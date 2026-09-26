(() => {
  if (globalThis.JobPilotConfiguredPortalFactory) return;

  const engine = globalThis.JobPilotPortalEngine;
  if (!engine) return;

  function textOf(root, selectors, max = 1000) {
    for (const selector of selectors || []) {
      let node = null;
      try { node = root.querySelector(selector); } catch (_) {}
      const value = engine.clean(node?.textContent || node?.innerText || "", max);
      if (value) return value;
    }
    return "";
  }

  function allTexts(root, selectors, limit = 40) {
    const output = [];

    for (const selector of selectors || []) {
      let nodes = [];
      try { nodes = Array.from(root.querySelectorAll(selector)); } catch (_) {}

      for (const node of nodes) {
        const value = engine.clean(node.textContent || node.innerText || "", 240);
        if (!value || value.length > 180) continue;
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

          if (Array.isArray(item["@graph"])) {
            queue.push(...item["@graph"]);
          }
        }
      } catch (_) {}
    }

    return null;
  }

  function stripHtml(value) {
    if (!value) return "";

    try {
      const doc = new DOMParser().parseFromString(String(value), "text/html");

      doc.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));

      doc.querySelectorAll("li").forEach((node) => {
        node.insertAdjacentText("afterbegin", "• ");
        node.insertAdjacentText("beforeend", "\n");
      });

      doc.querySelectorAll("p,h1,h2,h3,h4,h5,h6,div,section").forEach((node) => {
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
      ], 6);

      const text = pieces
        .filter((piece) => !/^[-–—]+$/.test(piece))
        .join(", ");

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

      return engine.clean(
        [currency, numbers, unit].filter(Boolean).join(" "),
        300
      );
    }

    return engine.clean(
      [currency, value].filter(Boolean).join(" "),
      300
    );
  }

  function identifierFromUrl(url) {
    const source = String(url || "");
    const patterns = [
      /[?&](?:jk|jobId|currentJobId)=([a-z0-9_-]+)/i,
      /\/view\/([a-z0-9_-]+)/i,
      /\/j\/[^/?#]*-(\d{5,})/i,
      /\/(\d{7,})(?:[/?#]|$)/i
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return match[1];
    }

    return "";
  }

  function sentenceItems(description) {
    const output = [];

    for (const rawLine of String(description || "").split(/\n+/)) {
      const line = engine.clean(
        rawLine
          .replace(/^[•●▪◦*\-–—]+\s*/, "")
          .replace(/^\d+[.)]\s*/, ""),
        1200
      );

      if (line.length < 12 || line.length > 1000) continue;

      const pieces = line
        .split(/(?<=[.!?;])\s+(?=[A-Z0-9])/)
        .map((piece) => engine.clean(piece, 900))
        .filter((piece) => piece.length >= 12);

      output.push(...pieces);
    }

    return engine.unique(output, 120);
  }

  function extractResponsibilities(description) {
    const actionPattern =
      /\b(develop|build|design|implement|maintain|create|collaborate|integrate|optimi[sz]e|debug|test|review|deliver|manage|lead|support|write|participate|ensure|own|architect|troubleshoot|deploy|drive|work with)\b/i;

    return engine.unique(
      sentenceItems(description).filter((item) =>
        actionPattern.test(item) &&
        !/\b(required|must have|should have|qualification|candidate should|experience in|proficien|knowledge of)\b/i.test(item)
      ),
      30
    );
  }

  function extractRequirements(description) {
    return engine.unique(
      sentenceItems(description).filter((item) =>
        /\b(required|must have|must possess|should have|required skills?|requirements?|qualification|candidate should|minimum .* years?|experience (?:in|with)|proficien(?:t|cy)|strong knowledge|hands[- ]on|expertise in)\b/i.test(item)
      ),
      35
    );
  }

  function extractPreferred(description) {
    return engine.unique(
      sentenceItems(description).filter((item) =>
        /\b(preferred|good to have|nice to have|plus|advantage|desirable)\b/i.test(item)
      ),
      25
    );
  }

  function skillsInStatements(skills, statements) {
    const haystack = statements.join(" ").toLowerCase();

    return engine.unique(
      (skills || []).filter((skill) => {
        const value = engine.clean(skill, 100).toLowerCase();
        if (value.length < 2) return false;

        const escaped = value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

        try {
          return new RegExp(
            "(^|[^a-z0-9])" + escaped + "([^a-z0-9]|$)",
            "i"
          ).test(haystack);
        } catch (_) {
          return haystack.includes(value);
        }
      }),
      40
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
    return engine.unique(
      sentenceItems(description).filter((item) =>
        /\b(b\.?e\.?|b\.?tech|m\.?tech|bachelor|master|degree|bca|mca|bsc|msc|computer science|engineering graduate|graduate degree)\b/i.test(item)
      ),
      10
    ).join(" | ");
  }

  function titleAnchor(card, config) {
    for (const selector of config.titleLinkSelectors || []) {
      let anchor = null;
      try { anchor = card.querySelector(selector); } catch (_) {}
      if (anchor) return anchor;
    }
    return null;
  }

  function cardCandidates(config) {
    const candidates = [];
    const seen = new Set();

    for (const selector of config.cardSelectors || []) {
      let nodes = [];
      try { nodes = Array.from(document.querySelectorAll(selector)); } catch (_) {}

      for (const node of nodes) {
        if (!(node instanceof Element) || seen.has(node)) continue;
        const anchor = titleAnchor(node, config);
        if (!anchor) continue;

        const text = engine.clean(node.innerText || node.textContent || "", 8000);
        if (text.length < 20 || text.length > 8000) continue;

        seen.add(node);
        candidates.push(node);
      }

      if (candidates.length >= 3) break;
    }

    if (!candidates.length) {
      const anchors = [];

      for (const selector of config.titleLinkSelectors || []) {
        try { anchors.push(...document.querySelectorAll(selector)); } catch (_) {}
      }

      for (const anchor of anchors) {
        const href = engine.absoluteUrl(anchor.getAttribute("href") || anchor.href);
        const title = engine.clean(
          anchor.getAttribute("aria-label") ||
          anchor.getAttribute("title") ||
          anchor.textContent,
          300
        );

        if (!href || !title || !config.isJobUrl(href)) continue;

        let node = anchor;
        let selected = null;

        for (let depth = 0; depth < 7 && node?.parentElement; depth += 1) {
          node = node.parentElement;
          const text = engine.clean(node.innerText || node.textContent || "", 8000);

          if (text.length >= 40 && text.length <= 4500) {
            selected = node;
            if (config.cardSignalPattern?.test(text) || depth >= 3) break;
          }
        }

        if (selected && !seen.has(selected)) {
          seen.add(selected);
          candidates.push(selected);
        }
      }
    }

    return candidates.slice(0, 75);
  }

  function makeListingCapture(config) {
    const cards = cardCandidates(config);
    const jobs = [];

    for (const card of cards) {
      const anchor = titleAnchor(card, config);
      if (!anchor) continue;

      const canonicalUrl = engine.absoluteUrl(
        anchor.getAttribute("href") || anchor.href
      );

      if (!canonicalUrl || !config.isJobUrl(canonicalUrl)) continue;

      const title =
        engine.clean(
          anchor.getAttribute("aria-label") ||
          anchor.getAttribute("title"),
          300
        ) ||
        engine.clean(anchor.textContent, 300);

      if (!title) continue;

      const company = textOf(card, config.companySelectors, 300);
      const experienceText = textOf(card, config.experienceSelectors, 250);
      const locationValue = textOf(card, config.locationSelectors, 500);
      const salaryText = textOf(card, config.salarySelectors, 300);
      const postedAge = textOf(card, config.postedSelectors, 180);
      const skills = engine.unique(
        allTexts(card, config.skillsSelectors, 30),
        30
      );
      const snippet = textOf(card, config.snippetSelectors, 1200);

      jobs.push({
        portalJobId:
          engine.clean(
            card.getAttribute?.("data-jk") ||
            card.getAttribute?.("data-job-id") ||
            card.getAttribute?.("data-entity-urn") ||
            "",
            180
          ) ||
          identifierFromUrl(canonicalUrl),

        canonicalUrl,
        title,
        company,
        location: locationValue,
        experienceText,
        salaryText,
        skills,
        snippet,
        postedAge,
        captureMethod: "configured-dom-card",

        sources: {
          title: "card-title",
          company: company ? "card-dom" : "",
          location: locationValue ? "card-dom" : "",
          experienceText: experienceText ? "card-dom" : "",
          salaryText: salaryText ? "card-dom" : "",
          skills: skills.length ? "card-dom" : "",
          snippet: snippet ? "card-dom" : "",
          postedAge: postedAge ? "card-dom" : ""
        }
      });
    }

    return {
      detected: cards.length,
      method: "configured-dom-card",
      jobs
    };
  }

  function makeDetailCapture(config) {
    const json = jsonLdJob();

    const dom = {
      title: textOf(document, config.detailTitleSelectors, 350),
      company: textOf(document, config.detailCompanySelectors, 300),
      experienceText: textOf(document, config.detailExperienceSelectors, 300),
      location: textOf(document, config.detailLocationSelectors, 500),
      salaryText: textOf(document, config.detailSalarySelectors, 300),
      description: textOf(document, config.detailDescriptionSelectors, 30000),
      skills: engine.unique(
        allTexts(document, config.detailSkillsSelectors, 50),
        50
      ),
      postedAge: textOf(document, config.detailPostedSelectors, 220),
      employmentType: textOf(document, config.detailEmploymentSelectors, 250)
    };

    const jsonSkills = engine.unique(
      Array.isArray(json?.skills)
        ? json.skills
        : String(json?.skills || json?.qualifications || "").split(/[,;|]/),
      50
    );

    const allSkills = engine.unique([...jsonSkills, ...dom.skills], 50);
    const jsonDescription = stripHtml(json?.description);
    const fullDescription = jsonDescription || dom.description;
    const locationText = jsonLocation(json?.jobLocation) || dom.location;
    const salaryText = jsonSalary(json?.baseSalary) || dom.salaryText;

    const canonicalUrl = engine.absoluteUrl(json?.url || location.href);

    const identifier =
      engine.clean(
        json?.identifier?.value ||
        json?.identifier?.name ||
        "",
        180
      ) ||
      identifierFromUrl(canonicalUrl);

    const requirementStatements = extractRequirements(fullDescription);
    const preferredStatements = extractPreferred(fullDescription);
    const responsibilities = extractResponsibilities(fullDescription);

    const requiredSkills = skillsInStatements(
      allSkills,
      requirementStatements
    );

    const preferredSkills = skillsInStatements(
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

    const education =
      explicitEducation ||
      educationFromDescription(fullDescription);

    const employmentType =
      Array.isArray(json?.employmentType)
        ? json.employmentType.join(", ")
        : engine.clean(json?.employmentType, 250) ||
          dom.employmentType;

    const workMode = inferWorkMode(fullDescription, locationText);

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
      company:
        engine.clean(json?.hiringOrganization?.name, 300) ||
        dom.company,
      experienceText: jsonExperience || dom.experienceText,
      location: locationText,
      salaryText,

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

      captureMethod:
        json
          ? "json-ld+configured-dom"
          : "configured-detail-dom",

      sources: {
        title: json?.title ? "json-ld" : dom.title ? "detail-dom" : "",
        company: json?.hiringOrganization?.name ? "json-ld" : dom.company ? "detail-dom" : "",
        experienceText: jsonExperience ? "json-ld" : dom.experienceText ? "detail-dom" : "",
        location: jsonLocation(json?.jobLocation) ? "json-ld" : dom.location ? "detail-dom" : "",
        salaryText: jsonSalary(json?.baseSalary) ? "json-ld" : dom.salaryText ? "detail-dom" : "",
        skills:
          jsonSkills.length && dom.skills.length
            ? "json-ld+detail-dom"
            : jsonSkills.length
              ? "json-ld"
              : dom.skills.length
                ? "detail-dom"
                : "",
        description: jsonDescription ? "json-ld" : dom.description ? "detail-dom" : "",
        responsibilities: responsibilities.length ? "jd-parser" : "",
        requiredSkills: requiredSkills.length ? "jd-parser" : "",
        preferredSkills: preferredSkills.length ? "jd-parser" : "",
        education: explicitEducation ? "json-ld" : education ? "jd-parser" : "",
        employmentType:
          json?.employmentType
            ? "json-ld"
            : dom.employmentType
              ? "detail-dom"
              : "",
        workMode: workMode ? "jd-parser" : "",
        datePosted: json?.datePosted ? "json-ld" : "",
        postedAge: dom.postedAge ? "detail-dom" : "",
        portalJobId: identifier ? "url/json-ld" : ""
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
      secondaryReady >= 1;

    return {
      method:
        json
          ? "json-ld+configured-dom"
          : "configured-detail-dom",
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

  function register(config) {
    if (!config?.id || !config?.hosts?.length) {
      throw new Error("Configured portal needs id and hosts.");
    }

    const matches = (url) => {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return config.hosts.some(
          (allowed) =>
            host === allowed ||
            host.endsWith("." + allowed)
        );
      } catch (_) {
        return false;
      }
    };

    const isDetail = () => {
      try {
        return config.isDetailPage(location);
      } catch (_) {
        return false;
      }
    };

    const isListing = () => {
      try {
        if (config.isListingPage?.(location)) return true;
      } catch (_) {}

      return cardCandidates(config).length > 0;
    };

    engine.registerAdapter({
      id: config.id,
      displayName: config.displayName,
      version: config.version || "1",

      matches,

      detectPage() {
        if (isDetail()) return "detail";
        if (isListing()) return "listing";
        return "unknown";
      },

      captureListing() {
        return makeListingCapture(config);
      },

      captureDetail() {
        return makeDetailCapture(config);
      }
    });
  }

  globalThis.JobPilotConfiguredPortalFactory = {
    register
  };
})();