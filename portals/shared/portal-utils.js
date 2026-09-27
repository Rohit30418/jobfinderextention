(() => {
  if (globalThis.JobPilotPortalUtils) return;

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
    const candidates = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent || "null");
        const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
        while (queue.length) {
          const item = queue.shift();
          if (!item || typeof item !== "object") continue;
          const type = item["@type"];
          if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) {
            candidates.push(item);
          }
          if (Array.isArray(item["@graph"])) queue.push(...item["@graph"]);
        }
      } catch (_) {}
    }
    const selected = identifierFromUrl(location.href);
    if (selected) return candidates.find(item => String(item.identifier?.value || item.identifier?.name || "") === selected || identifierFromUrl(item.url) === selected) || null;
    return candidates.length === 1 ? candidates[0] : null;
  }

  function stripHtml(value) {
    if (!value) return "";
    try {
      const doc = new DOMParser().parseFromString(String(value), "text/html");
      doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
      doc.querySelectorAll("li").forEach((n) => {
        n.insertAdjacentText("afterbegin", "• ");
        n.insertAdjacentText("beforeend", "\n");
      });
      doc.querySelectorAll("p,h1,h2,h3,h4,h5,h6,div,section").forEach((n) => {
        n.insertAdjacentText("beforeend", "\n");
      });
      return engine.clean(doc.body?.innerText || doc.body?.textContent || "", 30000);
    } catch (_) {
      return engine.clean(String(value).replace(/<[^>]+>/g, " "), 30000);
    }
  }

  function jsonLocation(value) {
    const items = Array.isArray(value) ? value : value ? [value] : [];
    const out = [];
    for (const item of items) {
      const address = item?.address || item;
      if (!address || typeof address !== "object") continue;
      const parts = engine.unique([
        address.addressLocality,
        address.addressRegion,
        address.addressCountry?.name || address.addressCountry
      ], 6).filter(Boolean);
      if (parts.length) out.push(parts.join(", "));
    }
    return engine.unique(out, 10).join(" | ");
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
      const amount = min !== "" && max !== "" ? min + " - " + max : String(min || max || "");
      return engine.clean([currency, amount, unit].filter(Boolean).join(" "), 300);
    }
    return engine.clean([currency, value].filter(Boolean).join(" "), 300);
  }

  function identifierFromUrl(url) {
    const source = String(url || "");
    const patterns = [
      /[?&](?:vjk|jk|jobId|currentJobId)=([a-z0-9_-]+)/i,
      /\/jobs\/view\/([a-z0-9_-]+)/i,
      /\/j\/[^/?#]*-(\d{5,})/i,
      /\/job(?:-detail)?\/[^/?#]*?(\d{5,})(?:[/?#]|$)/i,
      /\/(\d{7,})(?:[/?#]|$)/i
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return match[1];
    }
    return "";
  }

  function sentenceItems(description) {
    const out = [];
    for (const raw of String(description || "").split(/\n+/)) {
      const line = engine.clean(raw.replace(/^[•●▪◦*\-–—]+\s*/, "").replace(/^\d+[.)]\s*/, ""), 1200);
      if (line.length < 12 || line.length > 1000) continue;
      out.push(...line.split(/(?<=[.!?;])\s+(?=[A-Z0-9])/).map((x) => engine.clean(x, 900)).filter((x) => x.length >= 12));
    }
    return engine.unique(out, 120);
  }

  function enrichDescription(description, skills) {
    const items = sentenceItems(description);
    const requirements = engine.unique(items.filter((x) =>
      /\b(required|must have|must possess|should have|required skills?|requirements?|qualification|candidate should|minimum .* years?|experience (?:in|with)|proficien(?:t|cy)|strong knowledge|hands[- ]on|expertise in)\b/i.test(x)
    ), 35);
    const preferred = engine.unique(items.filter((x) =>
      /\b(preferred|good to have|nice to have|plus|advantage|desirable)\b/i.test(x)
    ), 25);
    const responsibilities = engine.unique(items.filter((x) =>
      /\b(develop|build|design|implement|maintain|create|collaborate|integrate|optimi[sz]e|debug|test|review|deliver|manage|lead|support|write|ensure|own|architect|troubleshoot|deploy|drive|work with)\b/i.test(x) &&
      !/\b(required|must have|qualification|experience in|proficien|knowledge of)\b/i.test(x)
    ), 30);

    const inStatements = (list) => {
      const haystack = list.join(" ").toLowerCase();
      return engine.unique((skills || []).filter((skill) => {
        const value = engine.clean(skill, 100).toLowerCase();
        if (value.length < 2) return false;
        const escaped = value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
        try { return new RegExp("(^|[^a-z0-9])" + escaped + "([^a-z0-9]|$)", "i").test(haystack); }
        catch (_) { return haystack.includes(value); }
      }), 40);
    };

    const education = engine.unique(items.filter((x) =>
      /\b(b\.?e\.?|b\.?tech|m\.?tech|bachelor|master|degree|bca|mca|bsc|msc|computer science|engineering graduate|graduate degree)\b/i.test(x)
    ), 10).join(" | ");

    const lower = String(description || "").toLowerCase();
    const workMode = /\bhybrid\b/.test(lower) ? "Hybrid"
      : /\bwork from home\b|\bremote\b|\bwfh\b/.test(lower) ? "Remote"
      : /\bwork from office\b|\bon[- ]site\b|\bonsite\b/.test(lower) ? "On-site"
      : "";

    return {
      responsibilities,
      requirementStatements: requirements,
      preferredStatements: preferred,
      requiredSkills: inStatements(requirements),
      preferredSkills: inStatements(preferred),
      education,
      workMode
    };
  }

  function createListing(config) {
    function titleAnchor(card) {
      for (const selector of config.titleLinkSelectors || []) {
        let node = null;
        try { node = card.querySelector(selector); } catch (_) {}
        if (node) return node;
      }
      return null;
    }

    function candidates() {
      const out = [];
      const seen = new Set();

      for (const selector of config.cardSelectors || []) {
        let nodes = [];
        try { nodes = Array.from(document.querySelectorAll(selector)); } catch (_) {}
        for (const node of nodes) {
          if (!(node instanceof Element) || seen.has(node)) continue;
          const anchor = titleAnchor(node);
          if (!anchor) continue;
          const href = engine.absoluteUrl(anchor.getAttribute("href") || anchor.href);
          if (!href || !config.isJobUrl(href)) continue;
          const txt = engine.clean(node.innerText || node.textContent || "", 8000);
          if (txt.length < 20 || txt.length > 8000) continue;
          seen.add(node);
          out.push(node);
        }
        if (out.length >= 3) break;
      }

      if (!out.length) {
        const anchors = [];
        for (const selector of config.titleLinkSelectors || []) {
          try { anchors.push(...document.querySelectorAll(selector)); } catch (_) {}
        }

        for (const anchor of anchors) {
          const href = engine.absoluteUrl(anchor.getAttribute("href") || anchor.href);
          const title = engine.clean(anchor.getAttribute("aria-label") || anchor.getAttribute("title") || anchor.textContent, 300);
          if (!href || !title || !config.isJobUrl(href)) continue;

          let node = anchor;
          let selected = null;
          for (let depth = 0; depth < 8 && node?.parentElement; depth += 1) {
            node = node.parentElement;
            const txt = engine.clean(node.innerText || node.textContent || "", 8000);
            if (txt.length >= 40 && txt.length <= 4500) {
              selected = node;
              if (config.cardSignalPattern?.test(txt) || depth >= 3) break;
            }
          }

          if (selected && !seen.has(selected)) {
            seen.add(selected);
            out.push(selected);
          }
        }
      }

      return out.slice(0, 100);
    }

    return {
      detect() {
        try {
          if (config.isListingPage?.(location)) return true;
        } catch (_) {}
        return candidates().length > 0;
      },

      capture() {
        const cards = candidates();
        const jobs = [];

        for (const card of cards) {
          const anchor = titleAnchor(card);
          if (!anchor) continue;
          const canonicalUrl = engine.absoluteUrl(anchor.getAttribute("href") || anchor.href);
          if (!canonicalUrl || !config.isJobUrl(canonicalUrl)) continue;

          const title = engine.clean(anchor.getAttribute("aria-label") || anchor.getAttribute("title") || anchor.textContent, 300);
          if (!title) continue;

          const company = textOf(card, config.companySelectors, 300);
          const experienceText = textOf(card, config.experienceSelectors, 250);
          const locationValue = textOf(card, config.locationSelectors, 500);
          const salaryText = textOf(card, config.salarySelectors, 300);
          const postedAge = textOf(card, config.postedSelectors, 180);
          const skills = engine.unique(allTexts(card, config.skillsSelectors, 30), 30);
          const snippet = textOf(card, config.snippetSelectors, 1200);

          jobs.push({
            portalJobId: engine.clean(
              card.getAttribute?.("data-jk") ||
              card.getAttribute?.("data-job-id") ||
              card.getAttribute?.("data-jobid") ||
              card.getAttribute?.("data-entity-urn") || "", 180
            ) || identifierFromUrl(canonicalUrl),
            canonicalUrl,
            title,
            company,
            location: locationValue,
            experienceText,
            salaryText,
            skills,
            snippet,
            postedAge,
            captureMethod: config.method || "portal-specific-dom-card",
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

        return { detected: cards.length, method: config.method || "portal-specific-dom-card", jobs };
      }
    };
  }

  function createDetail(config) {
    return {
      detect() {
        try { return Boolean(config.isDetailPage?.(location)); }
        catch (_) { return false; }
      },

      capture() {
        const json = jsonLdJob();
        const dom = {
          title: textOf(document, config.titleSelectors, 350),
          company: textOf(document, config.companySelectors, 300),
          experienceText: textOf(document, config.experienceSelectors, 300),
          location: textOf(document, config.locationSelectors, 500),
          salaryText: textOf(document, config.salarySelectors, 300),
          description: textOf(document, config.descriptionSelectors, 30000),
          skills: engine.unique(allTexts(document, config.skillsSelectors, 50), 50),
          postedAge: textOf(document, config.postedSelectors, 220),
          employmentType: textOf(document, config.employmentSelectors, 250)
        };

        const jsonSkills = engine.unique(
          Array.isArray(json?.skills) ? json.skills : String(json?.skills || json?.qualifications || "").split(/[,;|]/),
          50
        );
        const skills = engine.unique([...jsonSkills, ...dom.skills], 50);
        const description = stripHtml(json?.description) || dom.description;
        const canonicalUrl = engine.absoluteUrl(json?.url || location.href);
        const extras = enrichDescription(description, skills);

        const jsonExp = engine.clean(
          typeof json?.experienceRequirements === "string"
            ? json.experienceRequirements
            : json?.experienceRequirements?.monthsOfExperience
              ? json.experienceRequirements.monthsOfExperience + " months"
              : "",
          300
        );

        const job = {
          portalJobId: engine.clean(json?.identifier?.value || json?.identifier?.name || "", 180) || identifierFromUrl(canonicalUrl),
          canonicalUrl,
          title: engine.clean(json?.title, 350) || dom.title,
          company: engine.clean(json?.hiringOrganization?.name, 300) || dom.company,
          experienceText: jsonExp || dom.experienceText,
          location: jsonLocation(json?.jobLocation) || dom.location,
          salaryText: jsonSalary(json?.baseSalary) || dom.salaryText,
          skills,
          description,
          responsibilities: extras.responsibilities,
          requiredSkills: extras.requiredSkills,
          preferredSkills: extras.preferredSkills,
          requirementStatements: extras.requirementStatements,
          preferredStatements: extras.preferredStatements,
          postedAge: dom.postedAge,
          datePosted: engine.clean(json?.datePosted, 180),
          employmentType: Array.isArray(json?.employmentType)
            ? json.employmentType.join(", ")
            : engine.clean(json?.employmentType, 250) || dom.employmentType,
          education: engine.clean(
            typeof json?.educationRequirements === "string"
              ? json.educationRequirements
              : json?.educationRequirements?.credentialCategory || json?.educationRequirements?.name || "",
            1000
          ) || extras.education,
          workMode: extras.workMode,
          captureMethod: json ? "json-ld+portal-specific-dom" : "portal-specific-detail-dom",
          sources: {
            title: json?.title ? "json-ld" : dom.title ? "detail-dom" : "",
            company: json?.hiringOrganization?.name ? "json-ld" : dom.company ? "detail-dom" : "",
            description: json?.description ? "json-ld" : dom.description ? "detail-dom" : "",
            skills: jsonSkills.length ? "json-ld+detail-dom" : dom.skills.length ? "detail-dom" : "",
            datePosted: json?.datePosted ? "json-ld" : "",
            portalJobId: "url/json-ld"
          }
        };

        const signals = {
          title: Boolean(job.title),
          company: Boolean(job.company),
          description: job.description.length >= 80,
          experience: Boolean(job.experienceText),
          location: Boolean(job.location),
          skills: job.skills.length > 0,
          posted: Boolean(job.datePosted || job.postedAge)
        };
        const secondaryReady = [signals.company, signals.experience, signals.location, signals.skills, signals.posted].filter(Boolean).length;
        const ready = signals.title && signals.description && secondaryReady >= 1;

        return {
          method: job.captureMethod,
          job,
          readiness: {
            ready,
            secondaryReady,
            signals,
            reason: ready ? "detail-ready" : !signals.title ? "waiting-for-title" : !signals.description ? "waiting-for-description" : "waiting-for-core-fields"
          }
        };
      }
    };
  }

  globalThis.JobPilotPortalUtils = { createListing, createDetail, identifierFromUrl };
})();