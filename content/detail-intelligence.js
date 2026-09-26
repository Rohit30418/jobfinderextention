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
    const selectors = [
      ".dang-inner-html",
      ".jobDescription",
      "[class*='jobDescription']",
      "[class*='job-desc']"
    ];

    for (const selector of selectors) {
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
          <button class="btn" data-action="back" type="button">Back to Job List</button>
          <button class="btn" data-action="full-report" type="button">Full report</button>
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

    const requiredMatched =
      match.skills?.required?.matched || [];
    const requiredMissing =
      match.skills?.required?.missing || [];
    const preferredMatched =
      match.skills?.preferred?.matched || [];
    const preferredMissing =
      match.skills?.preferred?.missing || [];

    const aiLabel =
      result.aiStatus === "completed"
        ? "Puter AI analyzed"
        : result.aiStatus === "cached"
          ? "Puter AI cached"
          : result.puterReady
            ? "Puter AI ready"
            : "Local match only";

    content.innerHTML = `
      <div class="decision" data-action="${escapeHtml(decision.action)}">
        <div class="kicker">Application decision</div>
        <div class="action">${escapeHtml(decision.action)}</div>
        <div class="headline">${escapeHtml(decision.headline || "")}</div>
        <div class="meta">
          <span class="pill">${escapeHtml(match.verdict || "REVIEW")}</span>
          <span class="pill">${escapeHtml(decision.confidence || match.confidence?.level || "LOW")} evidence</span>
          <span class="pill">${escapeHtml(aiLabel)}</span>
        </div>
      </div>

      <div class="section">
        <h4>Required skills</h4>
        <div class="skills">
          ${renderSkills(requiredMatched, "good")}
          ${renderSkills(requiredMissing, "bad")}
        </div>
      </div>

      <div class="section">
        <h4>Preferred / nice to have</h4>
        <div class="skills">
          ${renderSkills(preferredMatched, "info")}
          ${renderSkills(preferredMissing, "warn")}
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

      <div class="legend">
        <span><i class="dot green"></i>matched required</span>
        <span><i class="dot red"></i>missing required</span>
        <span><i class="dot blue"></i>matched preferred</span>
        <span><i class="dot amber"></i>missing preferred</span>
      </div>

      <div class="buttons">
        <button class="btn primary" data-action="back" type="button">← Back to Job List</button>
        <button class="btn" data-action="refresh" type="button">Refresh</button>
        <button class="btn full" data-action="full-report" type="button">Open Full Analysis</button>
      </div>

      <div class="note">
        JobPilot highlights exact JD evidence. Portal facts remain authoritative.
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
      .querySelector('[data-action="full-report"]')
      ?.addEventListener("click", () => {
        chrome.runtime.sendMessage({
          type: "jobpilot:open-full-match"
        });
      });
  }

  async function backToList() {
    try {
      const result = await chrome.storage.local.get(
        LISTING_CONTEXT_KEY
      );
      const context = result[LISTING_CONTEXT_KEY];

      if (context?.sourceUrl) {
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

  tick();
  setInterval(tick, 900);
})();
