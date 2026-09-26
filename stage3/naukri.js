import {
  getNaukriNativeFilters,
  getPreferences,
  getState,
  getUniversalSearch,
  setNaukriSearch,
  setUniversalSearch
} from "../core/storage.js";

const $ = (selector) => document.querySelector(selector);

const PORTALS = [
  {
    id: "naukri",
    name: "Naukri",
    subtitle: "Multi-location query + learned native filters"
  },
  {
    id: "foundit",
    name: "Foundit",
    subtitle: "Role/query + one location + direct year range"
  },
  {
    id: "linkedin",
    name: "LinkedIn Jobs",
    subtitle: "Keywords + one location + posting-time window"
  },
  {
    id: "indeed",
    name: "Indeed",
    subtitle: "Query + one location + newest postings"
  },
  {
    id: "hirist",
    name: "Hirist",
    subtitle: "One role/location search at a time"
  }
];

const $els = {
  gateTitle: $("#gateTitle"),
  gateMeta: $("#gateMeta"),
  gateStatus: $("#gateStatus"),
  app: $("#app"),
  primaryRole: $("#primaryRole"),
  searchTerms: $("#searchTerms"),
  locations: $("#locations"),
  experienceMin: $("#experienceMin"),
  experienceMax: $("#experienceMax"),
  freshness: $("#freshness"),
  searchStatus: $("#searchStatus"),
  message: $("#message"),
  portalGrid: $("#portalGrid"),
  openSelectedBtn: $("#openSelectedBtn"),
  diagnosticsGrid: $("#diagnosticsGrid")
};

let profile = null;
let preferences = null;
let nativeFilters = null;
let savedUniversal = null;
let currentBuild = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function splitList(value) {
  return [...new Set(
    String(value || "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

function nullableInt(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number)
    ? Math.max(0, Math.round(number))
    : null;
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function hiristLocation(value) {
  return String(value || "")
    .split("/")
    .map((piece) =>
      piece
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter(Boolean)
    .join("_");
}

function freshnessDays(value) {
  return {
    "24h": 1,
    "3d": 3,
    "7d": 7,
    "14d": 14,
    "30d": 30,
    "any": null
  }[value] ?? null;
}

function linkedinFreshness(value) {
  const days = freshnessDays(value);
  return days ? "r" + (days * 86400) : "";
}

function naukriFreshness(value) {
  return {
    "24h": "1",
    "3d": "3",
    "7d": "7",
    "14d": "15",
    "30d": "30",
    "any": ""
  }[value] || "";
}

function experienceContextKey(min, max) {
  return String(min ?? "") + "|" + String(max ?? "");
}

function locationContextKey(locations) {
  return (locations || [])
    .map(normalizeKey)
    .filter(Boolean)
    .sort()
    .join("|");
}

function learnedNaukriExperience(min, max) {
  if (!nativeFilters?.experienceValue) return "";

  return nativeFilters.experienceContextKey ===
    experienceContextKey(min, max)
      ? String(nativeFilters.experienceValue)
      : "";
}

function learnedNaukriCities(locations) {
  if (!Array.isArray(nativeFilters?.cityTypeGids)) {
    return [];
  }

  return nativeFilters.locationContextKey ===
    locationContextKey(locations)
      ? nativeFilters.cityTypeGids
          .map(String)
          .filter(Boolean)
      : [];
}

function readSearch() {
  const primaryRole = $els.primaryRole.value.trim();
  let searchTerms = splitList($els.searchTerms.value);

  if (!searchTerms.length && primaryRole) {
    searchTerms = [primaryRole];
  }

  return {
    primaryRole,
    searchTerms,
    locations: splitList($els.locations.value),
    experienceMin: nullableInt($els.experienceMin.value),
    experienceMax: nullableInt($els.experienceMax.value),
    freshness: $els.freshness.value
  };
}

function validate(spec) {
  const errors = [];

  if (!spec.primaryRole) {
    errors.push("Choose a primary role.");
  }

  if (!spec.searchTerms.length) {
    errors.push("Add at least one search term.");
  }

  if (
    spec.experienceMin !== null &&
    spec.experienceMax !== null &&
    spec.experienceMin > spec.experienceMax
  ) {
    errors.push(
      "Minimum experience cannot be greater than maximum experience."
    );
  }

  return errors;
}

function buildNaukri(spec) {
  const params = new URLSearchParams();
  const keywords = spec.searchTerms.join(", ");
  const locationText = spec.locations.join(", ");

  params.set("k", keywords);

  if (locationText) {
    params.set("l", locationText);
  }

  const nativeExperience =
    learnedNaukriExperience(
      spec.experienceMin,
      spec.experienceMax
    );

  if (nativeExperience) {
    params.set("experience", nativeExperience);
  }

  const age = naukriFreshness(spec.freshness);

  if (age) {
    params.set("jobAge", age);
  }

  for (
    const gid of
    learnedNaukriCities(spec.locations)
  ) {
    params.append("cityTypeGid", gid);
  }

  const roleSlug =
    slugify(keywords || spec.primaryRole) ||
    "jobs";

  const primaryLocation =
    spec.locations[0]
      ? slugify(spec.locations[0])
      : "";

  const path =
    primaryLocation
      ? "/" + roleSlug + "-jobs-in-" + primaryLocation
      : "/" + roleSlug + "-jobs";

  const notes = [];

  if (
    (spec.experienceMin !== null ||
      spec.experienceMax !== null) &&
    !nativeExperience
  ) {
    notes.push(
      "Experience range is not encoded until JobPilot learns Naukri's native experience value."
    );
  }

  if (spec.locations.length > 1) {
    notes.push(
      "All locations are sent in l=. Learned cityTypeGid values are reused when available."
    );
  }

  return {
    url:
      "https://www.naukri.com" +
      path +
      "?" +
      params.toString(),
    support: {
      role: true,
      location: true,
      experience: Boolean(nativeExperience),
      freshness: true
    },
    note: notes.join(" ") || "Uses the Naukri URL format already verified in JobPilot."
  };
}

function buildFoundit(spec) {
  const params = new URLSearchParams();
  const location = spec.locations[0] || "";
  const query = spec.searchTerms.join(",");
  const pathTerm = slugify(
    spec.searchTerms[0] || spec.primaryRole
  );
  const locationSlug = slugify(location);

  params.set("start", "1");
  params.set("limit", "20");
  params.set("query", query);

  if (location) {
    params.set("location", location);
  }

  params.set(
    "queryEntity",
    spec.primaryRole + ":DESIGNATION"
  );

  if (
    spec.experienceMin !== null &&
    spec.experienceMax !== null
  ) {
    params.set(
      "experienceRanges",
      spec.experienceMin +
        "~" +
        spec.experienceMax
    );
  }

  params.set("queryDerived", "true");

  const days = freshnessDays(spec.freshness);

  if (days) {
    params.set("jobFreshness", String(days));
  }

  const path =
    "/search/" +
    (pathTerm || "jobs") +
    "-jobs" +
    (
      locationSlug
        ? "-in-" + locationSlug
        : ""
    );

  return {
    url:
      "https://www.foundit.in" +
      path +
      "?" +
      params.toString(),
    support: {
      role: true,
      location: Boolean(location),
      experience:
        spec.experienceMin !== null &&
        spec.experienceMax !== null,
      freshness: Boolean(days)
    },
    note:
      spec.locations.length > 1
        ? "Foundit uses the first location here. Run the hub again for another location."
        : "Uses Foundit's query, designation, experienceRanges and jobFreshness URL parameters."
  };
}

function buildLinkedIn(spec) {
  const params = new URLSearchParams();
  const location = spec.locations[0] || "";

  params.set(
    "keywords",
    spec.searchTerms.join(" ")
  );

  if (location) {
    params.set("location", location);
  }

  const tpr = linkedinFreshness(
    spec.freshness
  );

  if (tpr) {
    params.set("f_TPR", tpr);
    params.set("sortBy", "DD");
  }

  return {
    url:
      "https://www.linkedin.com/jobs/search/?" +
      params.toString(),
    support: {
      role: true,
      location: Boolean(location),
      experience: false,
      freshness: Boolean(tpr)
    },
    note:
      "LinkedIn experience is intentionally not derived from years; LinkedIn's f_E represents career levels. Freshness uses f_TPR."
  };
}

function buildIndeed(spec) {
  const params = new URLSearchParams();
  const location = spec.locations[0] || "";

  params.set(
    "q",
    spec.searchTerms.join(" ")
  );

  if (location) {
    params.set("l", location);
  }

  params.set("sort", "date");

  const days = freshnessDays(
    spec.freshness
  );

  if (days) {
    params.set("fromage", String(days));
  }

  params.set(
    "from",
    "searchOnDesktopSerp"
  );

  return {
    url:
      "https://in.indeed.com/jobs?" +
      params.toString(),
    support: {
      role: true,
      location: Boolean(location),
      experience: false,
      freshness: Boolean(days)
    },
    note:
      "Indeed uses one location in l=. The supplied URL does not encode a direct experience range, so JobPilot leaves experience unverified."
  };
}

function buildHirist(spec) {
  const params = new URLSearchParams();
  const location = spec.locations[0] || "";
  const roleSlug =
    slugify(spec.primaryRole) ||
    slugify(spec.searchTerms[0]);

  if (location) {
    params.set(
      "loc",
      hiristLocation(location)
    );
  }

  if (spec.experienceMin !== null) {
    params.set(
      "minexp",
      String(spec.experienceMin)
    );
  }

  if (spec.experienceMax !== null) {
    params.set(
      "maxexp",
      String(spec.experienceMax)
    );
  }

  params.set("sort", "date");

  const days = freshnessDays(
    spec.freshness
  );

  if (days) {
    params.set("posting", String(days));
  }

  params.set("category", "");
  params.set("searchType", "");
  params.set("method", "");

  return {
    url:
      "https://www.hirist.tech/search/" +
      roleSlug +
      "-jobs?" +
      params.toString(),
    support: {
      role: true,
      location: Boolean(location),
      experience:
        spec.experienceMin !== null ||
        spec.experienceMax !== null,
      freshness: Boolean(days)
    },
    note:
      spec.locations.length > 1
        ? "Hirist searches one location at a time. This URL uses the first saved location."
        : "Hirist uses the selected role, one location and direct minexp/maxexp/posting filters."
  };
}

function buildAll(spec) {
  return {
    naukri: buildNaukri(spec),
    foundit: buildFoundit(spec),
    linkedin: buildLinkedIn(spec),
    indeed: buildIndeed(spec),
    hirist: buildHirist(spec)
  };
}

function setMessage(text, type = "") {
  if (!text) {
    $els.message.textContent = "";
    $els.message.className =
      "message hidden";
    return;
  }

  $els.message.textContent = text;
  $els.message.className =
    "message" + (type ? " " + type : "");
}

function selectedPortalIds() {
  return Array.from(
    document.querySelectorAll(
      'input[name="portal"]:checked'
    )
  ).map((input) => input.value);
}

function renderSupport(support) {
  const labels = [
    ["Role", support.role],
    ["Location", support.location],
    ["Experience", support.experience],
    ["Freshness", support.freshness]
  ];

  return labels.map(([label, ok]) =>
    '<span class="tag ' +
      (ok ? "yes" : "partial") +
      '">' +
      escapeHtml(label) +
      " " +
      (ok ? "✓" : "△") +
    "</span>"
  ).join("");
}

function renderPortals(spec, builds) {
  const selected = new Set(
    savedUniversal?.selectedPortals?.length
      ? savedUniversal.selectedPortals
      : PORTALS.map((portal) => portal.id)
  );

  const previousSelected =
    selectedPortalIds();

  if (previousSelected.length) {
    selected.clear();
    previousSelected.forEach(
      (id) => selected.add(id)
    );
  }

  $els.portalGrid.innerHTML =
    PORTALS.map((portal) => {
      const build = builds[portal.id];

      return (
        '<article class="portal-card ' +
          (selected.has(portal.id)
            ? "selected"
            : "") +
        '" data-portal-card="' +
          portal.id +
        '">' +

          '<div class="portal-head">' +
            '<div class="portal-brand">' +
              '<input class="portal-check" type="checkbox" name="portal" value="' +
                portal.id +
                '" ' +
                (selected.has(portal.id)
                  ? "checked"
                  : "") +
              ">" +
              "<div>" +
                '<div class="portal-name">' +
                  escapeHtml(portal.name) +
                "</div>" +
                '<div class="portal-sub">' +
                  escapeHtml(portal.subtitle) +
                "</div>" +
              "</div>" +
            "</div>" +
            '<div class="support-tags">' +
              renderSupport(build.support) +
            "</div>" +
          "</div>" +

          '<code class="portal-url">' +
            escapeHtml(build.url) +
          "</code>" +

          '<div class="portal-note">' +
            escapeHtml(build.note) +
          "</div>" +

          '<div class="portal-actions">' +
            '<button class="btn" type="button" data-open="' +
              portal.id +
            '">Open ' +
              escapeHtml(portal.name) +
            "</button>" +
          "</div>" +
        "</article>"
      );
    }).join("");

  for (
    const checkbox of
    document.querySelectorAll(
      'input[name="portal"]'
    )
  ) {
    checkbox.addEventListener(
      "change",
      () => {
        checkbox
          .closest(".portal-card")
          ?.classList.toggle(
            "selected",
            checkbox.checked
          );

        updateOpenButton();
      }
    );
  }

  for (
    const button of
    document.querySelectorAll("[data-open]")
  ) {
    button.addEventListener(
      "click",
      async () => {
        await openPortals([
          button.dataset.open
        ]);
      }
    );
  }

  updateOpenButton();
}

function updateOpenButton() {
  const count = selectedPortalIds().length;

  $els.openSelectedBtn.textContent =
    count
      ? "Open selected searches (" +
        count +
        ")"
      : "Select a portal";

  $els.openSelectedBtn.disabled =
    count === 0;
}

function refreshPreview() {
  const spec = readSearch();
  const errors = validate(spec);
  const builds = buildAll(spec);

  currentBuild = {
    spec,
    builds
  };

  renderPortals(spec, builds);

  if (errors.length) {
    setMessage(
      errors.join(" "),
      "error"
    );
    $els.openSelectedBtn.disabled = true;
  } else {
    setMessage("");
  }

  refreshDiagnostics();

  return currentBuild;
}

async function saveSearchState(
  spec,
  builds,
  selectedPortals
) {
  savedUniversal = await setUniversalSearch({
    ...spec,
    selectedPortals,
    urls: Object.fromEntries(
      Object.entries(builds).map(
        ([id, build]) => [
          id,
          build.url
        ]
      )
    )
  });

  const naukri = builds.naukri;

  await setNaukriSearch({
    primaryRole: spec.primaryRole,
    keywords: spec.searchTerms.join(", "),
    locations: spec.locations,
    experienceMin: spec.experienceMin,
    experienceMax: spec.experienceMax,
    requestedFreshness: spec.freshness,
    naukriJobAge:
      naukriFreshness(spec.freshness) ||
      null,
    url: naukri.url
  });
}

async function openPortals(ids) {
  const built = refreshPreview();
  const errors = validate(built.spec);

  if (errors.length) return;

  const selected = ids.filter(
    (id) => built.builds[id]?.url
  );

  if (!selected.length) {
    setMessage(
      "Select at least one portal.",
      "error"
    );
    return;
  }

  await saveSearchState(
    built.spec,
    built.builds,
    selectedPortalIds()
  );

  for (const id of selected) {
    await chrome.tabs.create({
      url: built.builds[id].url
    });
  }

  $els.searchStatus.textContent =
    "Opened " + selected.length;

  setMessage(
    "Opened " +
      selected.map(
        (id) =>
          PORTALS.find(
            (portal) => portal.id === id
          )?.name || id
      ).join(", ") +
      ". JobPilot will capture each listing after it loads.",
    "success"
  );
}

function fillFromSaved() {
  const roles =
    Array.isArray(
      preferences.targetRoles
    )
      ? preferences.targetRoles
      : [];

  $els.primaryRole.innerHTML =
    roles.map((role) =>
      '<option value="' +
        escapeHtml(role) +
      '">' +
        escapeHtml(role) +
      "</option>"
    ).join("");

  const savedRole =
    savedUniversal?.primaryRole;

  if (
    savedRole &&
    roles.includes(savedRole)
  ) {
    $els.primaryRole.value = savedRole;
  } else if (roles.length) {
    $els.primaryRole.value = roles[0];
  }

  const defaultTerms =
    savedUniversal?.searchTerms?.length
      ? savedUniversal.searchTerms
      : [$els.primaryRole.value];

  $els.searchTerms.value =
    defaultTerms.join(", ");

  $els.locations.value =
    savedUniversal?.locations?.length
      ? savedUniversal.locations.join("\n")
      : Array.isArray(
          preferences.preferredLocations
        )
        ? preferences.preferredLocations.join("\n")
        : "";

  $els.experienceMin.value =
    savedUniversal?.experienceMin ??
    preferences.experienceMin ??
    "";

  $els.experienceMax.value =
    savedUniversal?.experienceMax ??
    preferences.experienceMax ??
    "";

  $els.freshness.value =
    savedUniversal?.freshness ||
    preferences.freshness ||
    "3d";
}

async function refreshDiagnostics() {
  if (!$els.diagnosticsGrid) return;

  const spec = readSearch();
  const builds = buildAll(spec);
  const loadedVersion =
    chrome.runtime.getManifest().version;

  const diagnostics = [
    [
      "Extension",
      true,
      "v" + loadedVersion
    ],
    [
      "Stage 1 profile",
      Boolean(profile),
      profile ? "Ready" : "Missing"
    ],
    [
      "Stage 2 preferences",
      Boolean(
        preferences?.updatedAt
      ),
      preferences?.updatedAt
        ? "Saved"
        : "Missing"
    ],
    [
      "Naukri builder",
      Boolean(builds.naukri.url),
      "Ready"
    ],
    [
      "Foundit builder",
      Boolean(builds.foundit.url),
      "Ready"
    ],
    [
      "LinkedIn builder",
      Boolean(builds.linkedin.url),
      "Ready · f_TPR freshness"
    ],
    [
      "Indeed builder",
      Boolean(builds.indeed.url),
      "Ready · fromage freshness"
    ],
    [
      "Hirist builder",
      Boolean(builds.hirist.url),
      "Ready · one search at a time"
    ]
  ];

  $els.diagnosticsGrid.innerHTML =
    diagnostics.map((item) =>
      '<div class="diag ' +
        (item[1] ? "pass" : "") +
      '">' +
        "<strong>" +
          (item[1] ? "PASS" : "WAIT") +
        "</strong>" +
        "<span>" +
          escapeHtml(
            item[0] + ": " + item[2]
          ) +
        "</span>" +
      "</div>"
    ).join("");
}

async function initialize() {
  const [
    state,
    pref,
    native,
    universal
  ] = await Promise.all([
    getState(),
    getPreferences(),
    getNaukriNativeFilters(),
    getUniversalSearch()
  ]);

  profile = state.profile || null;
  preferences = pref;
  nativeFilters = native;
  savedUniversal = universal;

  if (!profile) {
    $els.gateTitle.textContent =
      "Stage 1 profile is required";
    $els.gateMeta.textContent =
      "Save your resume/profile first.";
    $els.gateStatus.textContent =
      "Blocked";
    return;
  }

  if (
    !preferences?.updatedAt ||
    !preferences?.targetRoles?.length
  ) {
    $els.gateTitle.textContent =
      "Stage 2 preferences are required";
    $els.gateMeta.textContent =
      "Save at least one target role before searching.";
    $els.gateStatus.textContent =
      "Blocked";
    return;
  }

  $els.gateTitle.textContent =
    profile.currentRole ||
    profile.headline ||
    profile.name ||
    "Candidate profile";

  $els.gateMeta.textContent =
    preferences.targetRoles.length +
    " target role" +
    (
      preferences.targetRoles.length === 1
        ? ""
        : "s"
    ) +
    " · " +
    (
      preferences.preferredLocations?.length
        ? preferences.preferredLocations.length +
          " saved location" +
          (
            preferences.preferredLocations.length === 1
              ? ""
              : "s"
          )
        : "no location restriction"
    );

  $els.gateStatus.textContent = "Ready";
  $els.app.classList.remove("hidden");

  fillFromSaved();
  refreshPreview();
}

$els.openSelectedBtn.addEventListener(
  "click",
  async () => {
    await openPortals(
      selectedPortalIds()
    );
  }
);

for (const element of [
  $els.primaryRole,
  $els.searchTerms,
  $els.locations,
  $els.experienceMin,
  $els.experienceMax,
  $els.freshness
]) {
  element.addEventListener(
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA"
      ? "input"
      : "change",
    () => {
      if (
        element === $els.primaryRole &&
        (
          !$els.searchTerms.value.trim() ||
          savedUniversal?.searchTerms?.join(", ") ===
            $els.searchTerms.value.trim()
        )
      ) {
        $els.searchTerms.value =
          $els.primaryRole.value;
      }

      refreshPreview();
    }
  );
}

initialize().catch((error) => {
  $els.gateTitle.textContent =
    "Universal search could not initialize";
  $els.gateMeta.textContent =
    error?.message || String(error);
  $els.gateStatus.textContent =
    "Error";
});