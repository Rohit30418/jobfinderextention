(() => {
  if (globalThis.__JOBPILOT_DETAIL_INTELLIGENCE__) return;
  globalThis.__JOBPILOT_DETAIL_INTELLIGENCE__ = true;

  const HOST_ID = "jobpilot-detail-intelligence";
  const HIGHLIGHT_STYLE_ID = "jobpilot-jd-highlight-style";
  const LISTING_CONTEXT_KEY = "jobpilot.stage6.listingContext";

  let currentUrl = location.href;
  let currentJobKey = "";
  let running = false;
  let collapsed = false;
  let latestResult = null;
  let latestStatus = "waiting";
  let latestMessage = "Waiting for job details…";
  let lastHighlightSignature = "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function ensureHighlightStyle() {
    if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
      mark[data-jobpilot-highlight] {
        border-radius: 4px !important;
        padding: 1px 2px !important;
        box-decoration-break: clone !important;
        -webkit-box-decoration-break: clone !important;
      }

      mark[data-jobpilot-highlight="required-match"] {
        background: rgba(59, 200, 113, .20) !important;
        color: inherit !important;
        box-shadow: inset 0 -2px 0 rgba(59, 200, 113, .75) !important;
      }

      mark[data-jobpilot-highlight="required-missing"] {
        background: rgba(244, 92, 105, .18) !important;
        color: inherit !important;
        box-shadow: inset 0 -2px 0 rgba(244, 92, 105, .82) !important;
      }

      mark[data-jobpilot-highlight="preferred-match"] {
        background: rgba(72, 135, 255, .16) !important;
        color: inherit !important;
        box-shadow: inset 0 -2px 0 rgba(72, 135, 255, .72) !important;
      }

      mark[data-jobpilot-highlight="preferred-missing"] {
        background: rgba(238, 175, 62, .18) !important;
        color: inherit !important;
        box-shadow: inset 0 -2px 0 rgba(238, 175, 62, .78) !important;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function clearHighlights() {
    const marks = document.querySelectorAll("mark[data-jobpilot-highlight]");

    for (const mark of marks) {
      const parent = mark.parentNode;
      if (!parent) continue;

      parent.replaceChild(
        document.createTextNode(mark.textContent || ""),
        mark
      );

      try {
        parent.normalize();
      } catch (_) {}
    }

    lastHighlightSignature = "";
  }

  function detailRoot() {
    const host = location.hostname.toLowerCase();

    const portalSelectors =
      host.includes("linkedin.com")
        ? [
            ".jobs-description__content",
            ".jobs-box__html-content",
            ".show-more-less-html__markup",
            ".description__text"
          ]
        : host.includes("indeed.com")
          ? [
              "#jobDescriptionText",
              ".jobsearch-jobDescriptionText",
              "[class*='jobDescription']"
            ]
          : host.includes("foundit.in")
            ? [
                "[class*='job-description']",
                "[class*='jobDescription']",
                "[class*='jd-desc']",
                "[class*='description']"
              ]
            : host.includes("hirist.tech")
              ? [
                  "[class*='job-description']",
                  "[class*='jobDescription']",
                  "[class*='description']"
                ]
              : [
                  ".dang-inner-html",
                  ".jobDescription",
                  "[class*='jobDescription']",
                  "[class*='job-desc']"
                ];

    const fallbackSelectors = [
      "[itemprop='description']",
      "[data-testid*='jobDescription']",
      "[data-testid*='job-description']"
    ];

    for (const selector of [
      ...portalSelectors,
      ...fallbackSelectors
    ]) {
      try {
        const node = document.querySelector(selector);
        if (node) return node;
      } catch (_) {}
    }

    return null;
  }

  function alphaNumeric(value) {
    return /[a-z0-9]/i.test(value || "");
  }

  function validBoundary(text, index, length) {
    const first = text[index] || "";
    const last = text[index + length - 1] || "";
    const before = index > 0 ? text[index - 1] : "";
    const after =
      index + length < text.length
        ? text[index + length]
        : "";

    if (
      alphaNumeric(first) &&
      alphaNumeric(before)
    ) {
      return false;
    }

    if (
      alphaNumeric(last) &&
      alphaNumeric(after)
    ) {
      return false;
    }

    return true;
  }

  function highlightNode(textNode, terms) {
    const source = textNode.nodeValue || "";
    if (!source.trim()) return false;

    const lower = source.toLowerCase();
    const matches = [];

    for (const item of terms) {
      const needle = item.term.toLowerCase();
      if (!needle || needle.length < 2) continue;

      let from = 0;
      let count = 0;

      while (from < lower.length && count < 8) {
        const index = lower.indexOf(needle, from);
        if (index < 0) break;

        if (validBoundary(source, index, needle.length)) {
          matches.push({
            index,
            length: needle.length,
            kind: item.kind,
            label: item.label
          });
          count += 1;
        }

        from = index + needle.length;
      }
    }

    if (!matches.length) return false;

    matches.sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      return b.length - a.length;
    });

    const accepted = [];
    let cursor = -1;

    for (const match of matches) {
      if (match.index < cursor) continue;
      accepted.push(match);
      cursor = match.index + match.length;
    }

    if (!accepted.length) return false;

    const fragment = document.createDocumentFragment();
    let offset = 0;

    for (const match of accepted) {
      if (match.index > offset) {
        fragment.appendChild(
          document.createTextNode(
            source.slice(offset, match.index)
          )
        );
      }

      const mark = document.createElement("mark");
      mark.dataset.jobpilotHighlight = match.kind;
      mark.title = match.label;
      mark.textContent = source.slice(
        match.index,
        match.index + match.length
      );
      fragment.appendChild(mark);

      offset = match.index + match.length;
    }

    if (offset < source.length) {
      fragment.appendChild(
        document.createTextNode(source.slice(offset))
      );
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
    return true;
  }

  function applyHighlights(match) {
    if (!match?.skills) return;

    const root = detailRoot();
    if (!root) return;

    const termMap = new Map();

    const add = (values, kind, label) => {
      for (const value of values || []) {
        const term = String(value || "").trim();
        if (term.length < 2) continue;

        const key = term.toLowerCase();

        if (!termMap.has(key)) {
          termMap.set(key, {
            term,
            kind,
            label
          });
        }
      }
    };

    add(
      match.skills.required?.matched,
      "required-match",
      "JobPilot: matched required skill"
    );
    add(
      match.skills.required?.missing,
      "required-missing",
      "JobPilot: missing required skill"
    );
    add(
      match.skills.preferred?.matched,
      "preferred-match",
      "JobPilot: matched preferred skill"
    );
    add(
      match.skills.preferred?.missing,
      "preferred-missing",
      "JobPilot: missing preferred skill"
    );

    const terms = [...termMap.values()]
      .sort((a, b) => b.term.length - a.term.length)
      .slice(0, 40);

    const signature = JSON.stringify(
      terms.map((item) => [item.term, item.kind])
    );

    const existingMarks =
      root.querySelectorAll("mark[data-jobpilot-highlight]").length;

    if (
      signature === lastHighlightSignature &&
      existingMarks > 0
    ) {
      return;
    }

    clearHighlights();
    ensureHighlightStyle();

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;

          if (!parent) {
            return NodeFilter.FILTER_REJECT;
          }

          if (
            parent.closest(
              "script,style,noscript,mark[data-jobpilot-highlight]"
            )
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return node.nodeValue?.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    let current;

    while ((current = walker.nextNode())) {
      nodes.push(current);
      if (nodes.length >= 500) break;
    }

    let changed = 0;

    for (const node of nodes) {
      if (highlightNode(node, terms)) {
        changed += 1;
      }
      if (changed >= 120) break;
    }

    lastHighlightSignature = signature;
  }

  function captureCurrentDetail() {
    const engine = globalThis.JobPilotPortalEngine;

    if (!engine) {
      return {
        detailPage: false,
        ready: false,
        reason: "Portal engine unavailable"
      };
    }

    const adapter = engine.detectAdapter(location.href);
    const pageType = adapter?.detectPage?.() || "unknown";

    if (!adapter || pageType !== "detail") {
      return {
        detailPage: false,
        ready: false,
        reason: "Not a detail page"
      };
    }

    const result = adapter.captureDetail();

    if (
      result?.readiness &&
      result.readiness.ready === false
    ) {
      return {
        detailPage: true,
        ready: false,
        reason:
          result.readiness.reason ||
          "Waiting for job details"
      };
    }

    if (!result?.job) {
      return {
        detailPage: true,
        ready: false,
        reason: "Waiting for job data"
      };
    }

    const job = engine.normalizeJob(result.job, {
      portal: adapter.id,
      pageType: "detail",
      method:
        result.method ||
        result.job.captureMethod ||
        "unknown",
      adapterVersion: adapter.version
    });

    return {
      detailPage: true,
      ready: Boolean(job?.title),
      job,
      reason: job?.title
        ? "Ready"
        : "Waiting for title"
    };
  }

  function ensureHost() {
    let host = document.getElementById(HOST_ID);

    if (host) return host;

    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText =
      "all:initial;position:fixed;z-index:2147483646;";

    const shadow = host.attachShadow({ mode: "open" });

    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }

        * {
          box-sizing: border-box;
        }

        .panel {
          position: fixed;
          top: 86px;
          right: 18px;
          width: 380px;
          max-height: calc(100vh - 108px);
          overflow: auto;
          border: 1px solid #273448;
          border-radius: 18px;
          background:
            radial-gradient(circle at 100% 0, rgba(82, 239, 139, .12), transparent 220px),
            #0b1119;
          color: #edf5ff;
          box-shadow: 0 24px 70px rgba(0, 0, 0, .38);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 13px;
          line-height: 1.45;
        }

        .panel.collapsed {
          width: 58px;
          min-height: 58px;
          overflow: hidden;
        }

        .panel.collapsed .content,
        .panel.collapsed .brand-copy {
          display: none;
        }

        .head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 14px 12px;
          border-bottom: 1px solid #202c3e;
          position: sticky;
          top: 0;
          z-index: 2;
          background: rgba(11, 17, 25, .96);
          backdrop-filter: blur(10px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .logo {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          background: #6ff0a0;
          color: #07120b;
          font-size: 12px;
          font-weight: 950;
          flex: 0 0 auto;
        }

        .brand-copy span,
        .brand-copy strong {
          display: block;
        }

        .brand-copy span {
          color: #6ff0a0;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .brand-copy strong {
          margin-top: 2px;
          font-size: 14px;
        }

        .icon-btn {
          border: 1px solid #2a394e;
          background: #111a26;
          color: #c9d7e8;
          width: 30px;
          height: 30px;
          border-radius: 9px;
          cursor: pointer;
          font-weight: 900;
        }

        .content {
          padding: 14px;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 11px 12px;
          border: 1px solid #26344a;
          border-radius: 11px;
          background: #0d1621;
          color: #a9b7c8;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #324056;
          border-top-color: #6ff0a0;
          border-radius: 50%;
          animation: spin .8s linear infinite;
          flex: 0 0 auto;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .decision {
          border: 1px solid #344257;
          border-radius: 14px;
          padding: 14px;
          background: #0e1722;
        }

        .decision[data-action="APPLY"] {
          border-color: rgba(111, 240, 160, .42);
          background: rgba(35, 100, 60, .14);
        }

        .decision[data-action="REVIEW FIRST"] {
          border-color: rgba(239, 186, 75, .45);
          background: rgba(126, 91, 25, .12);
        }

        .decision[data-action="SKIP"] {
          border-color: rgba(255, 113, 128, .45);
          background: rgba(124, 36, 47, .14);
        }

        .kicker {
          color: #8493a8;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .action {
          margin: 3px 0 2px;
          font-size: 27px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -.035em;
          color: #efba4b;
        }

        .decision[data-action="APPLY"] .action {
          color: #7af1a6;
        }

        .decision[data-action="SKIP"] .action {
          color: #ff8995;
        }

        .headline {
          margin-top: 7px;
          color: #d9e5f2;
          font-size: 13px;
          font-weight: 800;
        }

        .scorebox {
          margin-top: 12px;
          padding: 11px 12px;
          border: 1px solid #2b3a4e;
          border-radius: 11px;
          background: #09111a;
        }

        .scoreline {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }

        .scoreline span {
          color: #8f9eb2;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .scoreline strong {
          font-size: 26px;
          color: #7af1a6;
          letter-spacing: -.03em;
        }

        .scorelabel {
          margin-top: 2px;
          color: #b8c5d5;
          font-size: 11px;
          font-weight: 800;
        }

        .scoretrack {
          height: 6px;
          margin-top: 8px;
          border-radius: 999px;
          background: #182334;
          overflow: hidden;
        }

        .scorefill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg,#f06b79,#dfaa44,#63d98f);
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }

        .pill,
        .skill {
          display: inline-flex;
          align-items: center;
          border: 1px solid #2c3b50;
          border-radius: 999px;
          padding: 4px 8px;
          background: #0b131d;
          color: #bdcada;
          font-size: 11px;
        }

        .pill.good,
        .skill.good {
          border-color: rgba(111, 240, 160, .36);
          color: #9ff7bf;
        }

        .pill.info,
        .skill.info {
          border-color: rgba(94, 145, 247, .42);
          color: #9fbcff;
        }

        .pill.bad,
        .skill.bad {
          border-color: rgba(255, 113, 128, .38);
          color: #ff9da7;
        }

        .pill.warn,
        .skill.warn {
          border-color: rgba(239, 186, 75, .42);
          color: #f2cb75;
        }

        .section {
          margin-top: 14px;
          border-top: 1px solid #202c3e;
          padding-top: 12px;
        }

        .section h4 {
          margin: 0 0 8px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: #8f9eb2;
        }

        .skills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .item {
          padding: 8px 9px;
          border: 1px solid #233147;
          border-radius: 9px;
          background: #0c141e;
          color: #c4d1e0;
          margin-top: 6px;
        }

        .item strong {
          display: block;
          color: #edf5ff;
          margin-bottom: 2px;
          font-size: 12px;
        }

        .item span {
          color: #8f9eb2;
          font-size: 11px;
        }

        .deep {
          margin-top: 14px;
          border: 1px solid #26354a;
          border-radius: 12px;
          background: #0a121c;
          overflow: hidden;
        }

        .deep > summary {
          list-style: none;
          cursor: pointer;
          padding: 11px 12px;
          font-weight: 900;
          color: #dce8f5;
          border-bottom: 1px solid transparent;
        }

        .deep[open] > summary {
          border-bottom-color: #223147;
        }

        .deep > summary::-webkit-details-marker {
          display: none;
        }

        .deep-content {
          padding: 11px 12px;
        }

        .breakdown {
          display: grid;
          gap: 7px;
        }

        .breakdown-row {
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 8px;
          align-items: center;
          padding: 7px 8px;
          border: 1px solid #223147;
          border-radius: 8px;
          background: #0b141e;
        }

        .breakdown-row span {
          color: #aebed0;
          font-size: 11px;
        }

        .breakdown-row strong {
          color: #edf5ff;
          font-size: 11px;
        }

        .kv {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
        }

        .kv > div {
          padding: 8px;
          border: 1px solid #223147;
          border-radius: 8px;
          background: #0b141e;
        }

        .kv span,
        .kv strong {
          display: block;
        }

        .kv span {
          color: #8091a8;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .kv strong {
          margin-top: 3px;
          color: #dfeafa;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .ai-summary {
          color: #aebdd0;
          font-size: 11px;
          line-height: 1.55;
        }

        .buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 14px;
        }

        .btn {
          border: 1px solid #314159;
          border-radius: 10px;
          padding: 9px 10px;
          background: #131d29;
          color: #e7f0fa;
          cursor: pointer;
          font: inherit;
          font-weight: 800;
        }

        .btn.primary {
          background: #6ff0a0;
          border-color: #6ff0a0;
          color: #06120a;
        }

        .btn.full {
          grid-column: 1 / -1;
        }

        .btn:disabled {
          opacity: .5;
          cursor: wait;
        }

        .note {
          margin-top: 10px;
          color: #7f8fa4;
          font-size: 11px;
        }

        .legend {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          margin-top: 10px;
        }

        .legend span {
          font-size: 10px;
          color: #8290a3;
        }

        .dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          margin-right: 5px;
          border-radius: 50%;
        }

        .dot.green { background: #63d98f; }
        .dot.red { background: #f06b79; }
        .dot.blue { background: #5e91f7; }
        .dot.amber { background: #dfaa44; }

        @media (max-width: 900px) {
          .panel {
            top: auto;
            right: 10px;
            left: 10px;
            bottom: 10px;
            width: auto;
            max-height: 62vh;
          }

          .panel.collapsed {
            left: auto;
            width: 58px;
          }
        }
      </style>

      <aside class="panel">
        <div class="head">
          <div class="brand">
            <div class="logo">JP</div>
            <div class="brand-copy">
              <span>JOBPILOT</span>
              <strong>Job intelligence</strong>
            </div>
          </div>
          <button class="icon-btn" data-action="collapse" type="button">—</button>
        </div>
        <div class="content"></div>
      </aside>
    `;

    document.documentElement.appendChild(host);

    shadow
      .querySelector('[data-action="collapse"]')
      .addEventListener("click", () => {
        collapsed = !collapsed;
        renderPanel();
      });

    return host;
  }

  function renderItems(items, emptyText = "None") {
    const list = Array.isArray(items) ? items : [];

    if (!list.length) {
      return `<div class="item"><span>${escapeHtml(emptyText)}</span></div>`;
    }

    return list
      .slice(0, 5)
      .map(
        (item) => `
          <div class="item">
            <strong>${escapeHtml(item.label || "Evidence")}</strong>
            <span>${escapeHtml(item.detail || "")}</span>
          </div>
        `
      )
      .join("");
  }

  function renderSkills(values, kind) {
    const list = Array.isArray(values) ? values : [];

    if (!list.length) {
      return '<span class="skill">None</span>';
    }

    return list
      .slice(0, 12)
      .map(
        (value) =>
          `<span class="skill ${kind}">${escapeHtml(value)}</span>`
      )
      .join("");
  }

  function renderScoreBreakdown(match) {
    const components = match?.matchScore?.components || [];

    if (!components.length) {
      return '<div class="item"><span>Score breakdown unavailable.</span></div>';
    }

    return '<div class="breakdown">' +
      components.map((component) =>
        '<div class="breakdown-row">' +
          '<span>' + escapeHtml(component.label || "Evidence") + '</span>' +
          '<strong>' +
            escapeHtml(
              component.points + "/" + component.weight
            ) +
          '</strong>' +
        '</div>'
      ).join("") +
    '</div>';
  }

  function renderTextValues(values, emptyText = "None") {
    const list = Array.isArray(values) ? values : [];

    if (!list.length) {
      return '<div class="item"><span>' + escapeHtml(emptyText) + '</span></div>';
    }

    return list.slice(0, 10).map((value) =>
      '<div class="item"><span>' + escapeHtml(value) + '</span></div>'
    ).join("");
  }

  function renderCoreCompatibility(match, job) {
    const rows = [
      ["Role fit", match?.role?.compatible ? "Compatible" : "Needs review"],
      ["Role family", match?.source?.roleFamily || "Unknown"],
      ["Seniority", match?.source?.seniority || "Unknown"],
      [
        "Candidate experience",
        match?.experience?.candidateYears == null
          ? "Unknown"
          : match.experience.candidateYears + " years"
      ],
      ["Job experience", job?.experienceText || "Unknown"],
      ["Location", job?.location || "Unknown"],
      ["Location result", match?.location?.status || "Unknown"],
      ["Work mode", job?.workMode || job?.aiAnalysis?.workMode || "Unknown"]
    ];

    return '<div class="kv">' +
      rows.map(([label, value]) =>
        '<div>' +
          '<span>' + escapeHtml(label) + '</span>' +
          '<strong>' + escapeHtml(value) + '</strong>' +
        '</div>'
      ).join("") +
    '</div>';
  }

  function renderPanel() {
    const host = ensureHost();
    const shadow = host.shadowRoot;
    const panel = shadow.querySelector(".panel");
    const content = shadow.querySelector(".content");
    const collapseButton = shadow.querySelector(
      '[data-action="collapse"]'
    );

    panel.classList.toggle("collapsed", collapsed);
    collapseButton.textContent = collapsed ? "JP" : "—";

    if (collapsed) {
      return;
    }

    if (latestStatus === "waiting") {
      content.innerHTML = `
        <div class="status">
          <span class="spinner"></span>
          <span>${escapeHtml(latestMessage)}</span>
        </div>
      `;
      return;
    }

    if (latestStatus === "error") {
      content.innerHTML = `
        <div class="status">
          <span>⚠</span>
          <span>${escapeHtml(latestMessage)}</span>
        </div>
        <div class="buttons">
          <button class="btn full" data-action="retry" type="button">Retry analysis</button>
          <button class="btn full" data-action="back" type="button">← Back to Job List</button>
        </div>
      `;
      bindActions(shadow);
      return;
    }

    const result = latestResult || {};
    const match = result.match || {};
    const decision = match.applyDecision || {
      action: "REVIEW FIRST",
      headline: "Review this job",
      confidence: match.confidence?.level || "LOW",
      reasons: [],
      cautions: []
    };

    const requiredExact =
      match.skills?.required?.exact || match.skills?.required?.matched || [];
    const requiredInferred =
      match.skills?.required?.inferred || [];
    const requiredPartial =
      match.skills?.required?.partial || [];
    const requiredMissing =
      match.skills?.required?.missing || [];

    const preferredExact =
      match.skills?.preferred?.exact || match.skills?.preferred?.matched || [];
    const preferredInferred =
      match.skills?.preferred?.inferred || [];
    const preferredPartial =
      match.skills?.preferred?.partial || [];
    const preferredMissing =
      match.skills?.preferred?.missing || [];

    const semanticEvidence =
      match.skills?.required?.evidence || {};

    const aiLabel =
      result.aiStatus === "completed"
        ? "Puter AI analyzed"
        : result.aiStatus === "cached"
          ? "Puter AI cached"
          : result.puterReady
            ? "Puter AI ready"
            : "Local match only";

    const scoreValue =
      Number.isFinite(match.matchScore?.score)
        ? match.matchScore.score
        : null;
    const scoreText =
      scoreValue === null ? "--" : scoreValue + "%";
    const scoreWidth =
      scoreValue === null ? 0 : scoreValue;
    const scoreLabel =
      match.matchScore?.label || "INSUFFICIENT DATA";

    const job = result.job || {};
    const ai = job.aiAnalysis || {};
    const blockers = match.blockers || [];
    const strengths = match.strengths || [];
    const gaps = match.gaps || [];
    const reviewItems = match.review || [];
    const explicitRequirements = match.explicitRequirements || [];
    const explicitDisqualifiers = match.explicitDisqualifiers || [];

    content.innerHTML = `
      <div class="decision" data-action="${escapeHtml(decision.action)}">
        <div class="kicker">Application decision</div>
        <div class="action">${escapeHtml(decision.action)}</div>
        <div class="headline">${escapeHtml(decision.headline || "")}</div>

        <div class="scorebox">
          <div class="scoreline">
            <span>Profile match</span>
            <strong>${escapeHtml(scoreText)}</strong>
          </div>
          <div class="scorelabel">${escapeHtml(scoreLabel)}</div>
          <div class="scoretrack">
            <div class="scorefill" style="width:${scoreWidth}%"></div>
          </div>
        </div>

        <div class="meta">
          <span class="pill">${escapeHtml(match.verdict || "REVIEW")}</span>
          <span class="pill">${escapeHtml(decision.confidence || match.confidence?.level || "LOW")} evidence</span>
          <span class="pill">${escapeHtml(aiLabel)}</span>
        </div>
      </div>

      <div class="section">
        <h4>Required skills</h4>
        <div class="skills">
          ${renderSkills(requiredExact, "good")}
          ${renderSkills(requiredInferred, "info")}
          ${renderSkills(requiredPartial, "warn")}
          ${renderSkills(requiredMissing, "bad")}
        </div>
        <div class="legend">
          <span><i class="dot green"></i>Exact</span>
          <span><i class="dot blue"></i>AI inferred</span>
          <span><i class="dot amber"></i>Partial</span>
          <span><i class="dot red"></i>Missing</span>
        </div>
      </div>

      <div class="section">
        <h4>Preferred / nice to have</h4>
        <div class="skills">
          ${renderSkills(preferredExact, "good")}
          ${renderSkills(preferredInferred, "info")}
          ${renderSkills(preferredPartial, "warn")}
          ${renderSkills(preferredMissing, "bad")}
        </div>
      </div>

      <div class="section">
        <h4>Why</h4>
        ${renderItems(decision.reasons, "No positive evidence yet.")}
      </div>

      <div class="section">
        <h4>Check before acting</h4>
        ${renderItems(decision.cautions, "Nothing important to review.")}
      </div>

      <details class="deep" open>
        <summary>Deep analysis</summary>
        <div class="deep-content">
          <div class="section" style="margin-top:0;border-top:0;padding-top:0">
            <h4>Match score breakdown</h4>
            ${renderScoreBreakdown(match)}
          </div>

          <div class="section">
            <h4>Role + experience</h4>
            ${renderCoreCompatibility(match, job)}
          </div>

          <div class="section">
            <h4>Hard blockers</h4>
            ${renderItems(blockers, "No hard blockers found.")}
          </div>

          <div class="section">
            <h4>Strong signals</h4>
            ${renderItems(strengths, "No strong positive signals yet.")}
          </div>

          <div class="section">
            <h4>AI semantic evidence</h4>
            ${
              Object.entries(semanticEvidence)
                .filter(([, value]) =>
                  value &&
                  ["INFERRED", "PARTIAL"].includes(String(value.status || "").toUpperCase())
                )
                .slice(0, 12)
                .map(([requirement, value]) =>
                  '<div class="item">' +
                    '<strong>' +
                      escapeHtml(requirement) +
                      ' · ' +
                      escapeHtml(String(value.status || "").toUpperCase()) +
                    '</strong>' +
                    '<span>' +
                      escapeHtml(
                        value.explanation ||
                        (
                          Array.isArray(value.evidence) && value.evidence.length
                            ? "Evidence: " + value.evidence.join(", ")
                            : "Semantic evidence found in the saved profile."
                        )
                      ) +
                    '</span>' +
                  '</div>'
                )
                .join("") ||
              '<div class="item"><span>No inferred or partial semantic matches for this job.</span></div>'
            }
          </div>

          <div class="section">
            <h4>Gaps</h4>
            ${renderItems(gaps, "No major gaps identified.")}
          </div>

          <div class="section">
            <h4>Needs review</h4>
            ${renderItems(reviewItems, "Nothing additional to review.")}
          </div>

          <div class="section">
            <h4>Explicit requirements</h4>
            ${renderTextValues(explicitRequirements, "No explicit must-have statements identified.")}
          </div>

          <div class="section">
            <h4>Explicit constraints</h4>
            ${renderTextValues(explicitDisqualifiers, "No explicit disqualifiers identified.")}
          </div>

          <div class="section">
            <h4>Puter AI interpretation</h4>
            <div class="kv">
              <div>
                <span>Role family</span>
                <strong>${escapeHtml(ai.roleFamily || "Unknown")}</strong>
              </div>
              <div>
                <span>Seniority</span>
                <strong>${escapeHtml(ai.seniority || "Unknown")}</strong>
              </div>
              <div>
                <span>Domain</span>
                <strong>${escapeHtml(ai.domain || "Unknown")}</strong>
              </div>
              <div>
                <span>Employment type</span>
                <strong>${escapeHtml(ai.employmentType || job.employmentType || "Unknown")}</strong>
              </div>
            </div>
            <div class="ai-summary" style="margin-top:8px">
              ${escapeHtml(ai.summary || "AI summary not available.")}
            </div>
          </div>

          <div class="section">
            <h4>Responsibilities</h4>
            ${renderTextValues(
              ai.responsibilities?.length
                ? ai.responsibilities
                : job.responsibilities,
              "No responsibilities were structured."
            )}
          </div>
        </div>
      </details>

      <div class="legend">
        <span><i class="dot green"></i>matched required</span>
        <span><i class="dot red"></i>missing required</span>
        <span><i class="dot blue"></i>matched preferred</span>
        <span><i class="dot amber"></i>missing preferred</span>
      </div>

      <div class="buttons">
        <button class="btn primary" data-action="back" type="button">← Back to Job List</button>
        <button class="btn" data-action="refresh" type="button">Refresh analysis</button>
        <button class="btn full ${result.applied ? "" : "primary"}" data-action="applied" type="button">
          ${result.applied ? "Undo Applied" : "Mark Applied"}
        </button>
      </div>

      <div class="note">
        Full deep analysis now stays on this job page. Match % ranks compatibility; APPLY / REVIEW FIRST / SKIP takes precedence when a blocker or unresolved mandatory requirement exists.
      </div>
    `;

    bindActions(shadow);
  }

  function bindActions(shadow) {
    shadow
      .querySelector('[data-action="back"]')
      ?.addEventListener("click", backToList);

    shadow
      .querySelector('[data-action="refresh"]')
      ?.addEventListener("click", () => analyzeCurrent(true));

    shadow
      .querySelector('[data-action="retry"]')
      ?.addEventListener("click", () => analyzeCurrent(false));

    shadow
      .querySelector('[data-action="applied"]')
      ?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const job = latestResult?.job;

        if (!job || !button) return;

        button.disabled = true;
        button.textContent = "Saving…";

        try {
          const response = await chrome.runtime.sendMessage({
            type: "jobpilot:toggle-applied",
            job,
            source: "job-detail"
          });

          if (!response?.ok) {
            throw new Error(
              response?.error || "Could not update applied status."
            );
          }

          latestResult = {
            ...latestResult,
            applied: response.applied === true
          };

          renderPanel();
        } catch (error) {
          button.disabled = false;
          button.textContent =
            error?.message || "Could not update";
        }
      });

  }

  async function backToList() {
    try {
      const result = await chrome.storage.local.get(
        LISTING_CONTEXT_KEY
      );

      const context = result[LISTING_CONTEXT_KEY];
      const currentPortal =
        latestResult?.job?.portal || "";

      if (
        context?.sourceUrl &&
        (
          !currentPortal ||
          !context.portal ||
          context.portal === currentPortal
        )
      ) {
        location.href = context.sourceUrl;
        return;
      }
    } catch (_) {}

    history.back();
  }

  async function analyzeCurrent(forceAi = false) {
    if (running) return;

    const capture = captureCurrentDetail();

    if (!capture.detailPage) {
      latestStatus = "waiting";
      latestMessage = "Waiting for a job detail page…";
      latestResult = null;
      clearHighlights();
      document.getElementById(HOST_ID)?.remove();
      return;
    }

    if (!capture.ready) {
      latestStatus = "waiting";
      latestMessage =
        capture.reason || "Waiting for job details…";
      latestResult = null;
      renderPanel();
      return;
    }

    const job = capture.job;
    const jobIdentity =
      job.key ||
      job.portalJobId ||
      job.canonicalUrl ||
      location.href;

    if (
      !forceAi &&
      latestStatus === "ready" &&
      currentJobKey === jobIdentity
    ) {
      if (latestResult?.match) {
        applyHighlights(latestResult.match);
      }
      return;
    }

    running = true;
    currentJobKey = jobIdentity;
    latestStatus = "waiting";
    latestMessage =
      forceAi
        ? "Refreshing AI + match…"
        : "Analyzing this job…";
    renderPanel();

    try {
      const response = await chrome.runtime.sendMessage({
        type: "jobpilot:inline-analyze",
        job,
        forceAi
      });

      if (!response?.ok) {
        throw new Error(
          response?.error ||
          "JobPilot analysis failed."
        );
      }

      latestResult = response;
      latestStatus = "ready";
      latestMessage = "";
      renderPanel();

      if (response.match) {
        applyHighlights(response.match);
      }
    } catch (error) {
      latestStatus = "error";
      latestMessage =
        error?.message || String(error);
      renderPanel();
    } finally {
      running = false;
    }
  }

  function tick() {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      currentJobKey = "";
      latestResult = null;
      latestStatus = "waiting";
      latestMessage = "Waiting for job details…";
      clearHighlights();
      document.getElementById(HOST_ID)?.remove();
    }

    analyzeCurrent(false);
  }

  setTimeout(tick, 700);
  setInterval(tick, 900);
})();
