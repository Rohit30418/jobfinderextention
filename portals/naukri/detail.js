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

  function allTexts(root, selectors, limit = 40) {
    const output = [];

    for (const selector of selectors) {
      let nodes = [];
      try { nodes = Array.from(root.querySelectorAll(selector)); } catch (_) {}

      for (const node of nodes) {
        const value = engine.clean(node.textContent || node.innerText || "", 200);
        if (!value || value.length > 120) continue;
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
      return engine.clean(doc.body?.innerText || doc.body?.textContent || "", 30000);
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

      const text = engine.unique([
        address.addressLocality,
        address.addressRegion,
        address.addressCountry?.name || address.addressCountry
      ], 6).join(", ");

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

  function detect() {
    return location.pathname.toLowerCase().includes("job-listings-");
  }

  function capture() {
    const json = jsonLdJob();

    const dom = {
      title: textOf(document, [".jd-header-title", "[class*='jd-header-title']", "h1"], 350),
      company: textOf(document, [
        ".jd-header-comp-name",
        ".jd-header-comp-name a",
        "[class*='comp-name']",
        "[class*='company-name']"
      ], 300),
      experienceText: textOf(document, [
        ".exp",
        "[class*='experience']",
        "[class*='exp-wrap']"
      ], 250),
      location: textOf(document, [
        ".loc",
        "[class*='location']",
        "[class*='loc-wrap']"
      ], 500),
      salaryText: textOf(document, [
        ".salary",
        "[class*='salary']",
        "[class*='sal-wrap']"
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
          "[class*='skills'] li"
        ], 40),
        40
      ),
      postedAge: textOf(document, [
        ".jd-stats",
        "[class*='jd-stats']",
        "[class*='posted']"
      ], 300)
    };

    const jsonSkills = engine.unique(
      Array.isArray(json?.skills)
        ? json.skills
        : String(json?.skills || json?.qualifications || "").split(/[,;|]/),
      40
    );

    const canonicalUrl = engine.absoluteUrl(json?.url || location.href);
    const identifier = engine.clean(json?.identifier?.value, 160);

    return {
      method: json ? "json-ld+dom" : "dom-detail",
      job: {
        portalJobId: identifier,
        canonicalUrl,
        title: engine.clean(json?.title, 350) || dom.title,
        company: engine.clean(json?.hiringOrganization?.name, 300) || dom.company,
        experienceText:
          engine.clean(
            typeof json?.experienceRequirements === "string"
              ? json.experienceRequirements
              : "",
            300
          ) || dom.experienceText,
        location: jsonLocation(json?.jobLocation) || dom.location,
        salaryText: jsonSalary(json?.baseSalary) || dom.salaryText,
        skills: jsonSkills.length ? jsonSkills : dom.skills,
        description: stripHtml(json?.description) || dom.description,
        postedAge: dom.postedAge,
        datePosted: engine.clean(json?.datePosted, 180),
        employmentType: Array.isArray(json?.employmentType)
          ? json.employmentType.join(", ")
          : engine.clean(json?.employmentType, 250),
        education:
          engine.clean(
            typeof json?.educationRequirements === "string"
              ? json.educationRequirements
              : json?.educationRequirements?.credentialCategory ||
                json?.educationRequirements?.name ||
                "",
            1000
          ),
        captureMethod: json ? "json-ld+dom" : "dom-detail",
        sources: {
          title: json?.title ? "json-ld" : dom.title ? "detail-dom" : "",
          company: json?.hiringOrganization?.name ? "json-ld" : dom.company ? "detail-dom" : "",
          experienceText: json?.experienceRequirements ? "json-ld" : dom.experienceText ? "detail-dom" : "",
          location: json?.jobLocation ? "json-ld" : dom.location ? "detail-dom" : "",
          salaryText: json?.baseSalary ? "json-ld" : dom.salaryText ? "detail-dom" : "",
          skills: jsonSkills.length ? "json-ld" : dom.skills.length ? "detail-dom" : "",
          description: json?.description ? "json-ld" : dom.description ? "detail-dom" : "",
          datePosted: json?.datePosted ? "json-ld" : "",
          postedAge: dom.postedAge ? "detail-dom" : ""
        }
      }
    };
  }

  globalThis.JobPilotNaukriDetail = {
    detect,
    capture,
    version: "1"
  };
})();
