(() => {
  if (globalThis.JobPilotNaukriListing) return;

  const engine = globalThis.JobPilotPortalEngine;

  function textOf(root, selectors, max = 500) {
    for (const selector of selectors) {
      let node = null;
      try { node = root.querySelector(selector); } catch (_) {}
      const value = engine.clean(node?.textContent || node?.innerText || "", max);
      if (value) return value;
    }
    return "";
  }

  function allTexts(root, selectors, limit = 24) {
    const output = [];

    for (const selector of selectors) {
      let nodes = [];
      try { nodes = Array.from(root.querySelectorAll(selector)); } catch (_) {}

      for (const node of nodes) {
        const value = engine.clean(node.textContent || node.innerText || "", 140);
        if (!value || value.length > 100) continue;
        if (!output.includes(value)) output.push(value);
        if (output.length >= limit) return output;
      }
    }

    return output;
  }

  function jobIdFrom(root, url) {
    for (const attribute of ["data-job-id", "data-id", "data-jobid", "id"]) {
      const value = engine.clean(root?.getAttribute?.(attribute), 160);
      if (value && /\d{5,}/.test(value)) return value.match(/\d{5,}/)?.[0] || value;
    }

    const digits = String(url || "").match(/\d{7,}/g);
    return digits?.[digits.length - 1] || "";
  }

  function titleAnchor(card) {
    return card.querySelector(
      "h2 a.title, a.title, h2 a[href], h3 a[href], a[href*='job-listings']"
    );
  }

  function cardCandidates() {
    const candidates = [];
    const seen = new Set();

    const selectors = [
      ".cust-job-tuple",
      ".srp-jobtuple-wrapper",
      "[class*='jobTuple']",
      "[class*='job-tuple']",
      "[class*='jobCard']",
      "[class*='job-card']",
      "article"
    ];

    for (const selector of selectors) {
      let nodes = [];
      try { nodes = Array.from(document.querySelectorAll(selector)); } catch (_) {}

      for (const node of nodes) {
        if (!(node instanceof Element) || seen.has(node)) continue;
        const anchor = titleAnchor(node);
        if (!anchor) continue;

        const text = engine.clean(node.innerText || node.textContent || "", 7000);
        if (text.length < 20 || text.length > 7000) continue;

        seen.add(node);
        candidates.push(node);
      }

      if (candidates.length >= 3) break;
    }

    // Structural fallback: locate job title links and walk up to a compact card.
    if (!candidates.length) {
      const anchors = Array.from(
        document.querySelectorAll(
          "h2 a, h3 a, a.title, a[href*='job-listings']"
        )
      );

      for (const anchor of anchors) {
        const href = engine.absoluteUrl(anchor.getAttribute("href") || anchor.href);
        const title = engine.clean(anchor.textContent || anchor.getAttribute("title"), 260);

        if (!href || !/naukri\.com/i.test(href) || !title) continue;

        let node = anchor;
        let selected = null;

        for (let depth = 0; depth < 7 && node?.parentElement; depth += 1) {
          node = node.parentElement;
          const text = engine.clean(node.innerText || node.textContent || "", 7000);
          const saveSignal = /\bsave\b/i.test(text);
          const experienceSignal = /\b\d+\s*(?:-|–|to)\s*\d+\s*(?:yrs?|years?)\b/i.test(text);

          if (
            text.length >= 40 &&
            text.length <= 3500 &&
            (saveSignal || experienceSignal)
          ) {
            selected = node;
            break;
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

  function detect() {
    const path = location.pathname.toLowerCase();
    if (path.includes("job-listings-")) return false;

    const params = new URLSearchParams(location.search);
    return (
      /-jobs(?:-in-)?/.test(path) ||
      params.has("k") ||
      params.has("l") ||
      params.has("jobAge") ||
      cardCandidates().length > 0
    );
  }

  function capture() {
    const cards = cardCandidates();
    const jobs = [];

    for (const card of cards) {
      const anchor = titleAnchor(card);
      if (!anchor) continue;

      const canonicalUrl = engine.absoluteUrl(anchor.getAttribute("href") || anchor.href);
      const title =
        engine.clean(anchor.getAttribute("title"), 300) ||
        engine.clean(anchor.textContent, 300);

      if (!title) continue;

      const company = textOf(card, [
        ".comp-name",
        ".companyInfo .subTitle",
        "[class*='comp-name']",
        "[class*='company-name']",
        "[class*='companyName']"
      ], 300);

      const experienceText = textOf(card, [
        ".expwdth",
        "[class*='expwdth']",
        "[class*='experience']"
      ], 220);

      const locationValue = textOf(card, [
        ".locWdth",
        "[class*='locWdth']",
        "[class*='location']"
      ], 400);

      const salaryText = textOf(card, [
        ".sal",
        "[class*='salary']",
        "[class*='sal-wrap']"
      ], 250);

      const postedAge = textOf(card, [
        ".job-post-day",
        "[class*='job-post-day']",
        "[class*='posted']",
        "[class*='post-day']"
      ], 160);

      const skills = engine.unique(
        allTexts(card, [
          ".tags-gt .tag-li",
          ".tags-gt li",
          "[class*='tag-li']",
          "[class*='skill']",
          "[class*='tags'] li"
        ], 30),
        30
      );

      const snippet = textOf(card, [
        ".job-desc",
        "[class*='job-desc']",
        "[class*='job-description']",
        "[class*='description']"
      ], 1000);

      jobs.push({
        portalJobId: jobIdFrom(card, canonicalUrl),
        canonicalUrl,
        title,
        company,
        location: locationValue,
        experienceText,
        salaryText,
        skills,
        snippet,
        postedAge,
        captureMethod: "dom-card",
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
      method: "dom-card",
      jobs
    };
  }

  globalThis.JobPilotNaukriListing = {
    detect,
    capture,
    version: "1"
  };
})();
