let nativeFilters = {};
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


export function buildPortalSearches(spec, learned = {}) { nativeFilters = learned; return buildAll(spec); }
