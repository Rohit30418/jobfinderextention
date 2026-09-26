function clean(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function unique(values) {
  const seen = new Set();
  const output = [];

  for (const raw of values || []) {
    const value = clean(raw)
      .replace(/^[•●▪◦·*-]+\s*/, "")
      .replace(/[;,|]+$/, "")
      .trim();

    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }

  return output;
}

function lines(text) {
  return String(text || "")
    .split("\n")
    .map(clean)
    .filter(Boolean);
}

const SECTION_ALIASES = new Map([
  ["summary", ["summary", "profile", "professional summary", "career summary", "objective"]],
  ["skills", ["skills", "technical skills", "core skills", "key skills", "technology", "technologies"]],
  ["experience", ["experience", "work experience", "professional experience", "employment", "employment history", "work history"]],
  ["projects", ["projects", "technical projects", "project experience", "personal projects", "notable projects"]],
  ["education", ["education", "academic background", "academics", "qualification", "qualifications"]],
  ["certifications", ["certifications", "certification", "licenses & certifications", "licenses and certifications"]],
  ["achievements", ["achievements", "awards", "recognition"]]
]);

function normalizedHeading(line) {
  return clean(line)
    .toLowerCase()
    .replace(/[:|]+$/, "")
    .replace(/\s+/g, " ");
}

function sectionName(line) {
  const normalized = normalizedHeading(line);

  for (const [name, aliases] of SECTION_ALIASES.entries()) {
    if (aliases.includes(normalized)) {
      return name;
    }
  }

  return "";
}

function splitSections(text) {
  const all = lines(text);
  const sections = {
    header: [],
    summary: [],
    skills: [],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    achievements: []
  };

  let current = "header";

  for (const line of all) {
    const next = sectionName(line);

    if (next) {
      current = next;
      continue;
    }

    sections[current].push(line);
  }

  return sections;
}

function looksLikeContact(line) {
  return (
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(line) ||
    /(?:linkedin\.com|github\.com|https?:\/\/|www\.)/i.test(line) ||
    /(?:\+?\d[\d\s().-]{7,}\d)/.test(line)
  );
}

function looksLikeName(line) {
  if (!line || looksLikeContact(line)) return false;
  if (line.length < 3 || line.length > 60) return false;
  if (/\d/.test(line)) return false;

  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;

  return words.every((word) => /^[A-Za-z][A-Za-z'.-]*$/.test(word));
}

function extractName(sections) {
  const candidates = sections.header.slice(0, 8);

  for (const line of candidates) {
    if (looksLikeName(line)) {
      return line
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }
  }

  return "";
}

function looksLikeHeadline(line) {
  if (!line || looksLikeContact(line)) return false;
  if (line.length < 4 || line.length > 180) return false;

  return (
    /developer|engineer|designer|manager|analyst|architect|consultant|specialist|lead|frontend|front-end|backend|fullstack|full-stack|software|web|ui|ux/i.test(line) ||
    line.includes("|")
  );
}

function extractHeadline(sections, name) {
  for (const line of sections.header.slice(0, 12)) {
    if (clean(line).toLowerCase() === clean(name).toLowerCase()) continue;
    if (looksLikeHeadline(line)) return line;
  }

  return "";
}

function extractExperienceMonths(text) {
  const patterns = [
    /\b(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s+of\s+(?:professional\s+)?experience\b/i,
    /\b(?:over\s+)?(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s+(?:professional\s+)?experience\b/i,
    /\bexperience\s*(?:of|:)\s*(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\b/i
  ];

  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) {
      return Math.round(Number(match[1]) * 12);
    }
  }

  return 0;
}

function roleFromSummary(text) {
  const patterns = [
    /\b((?:senior\s+|junior\s+|lead\s+)?(?:front[ -]?end|backend|full[ -]?stack|software|web|ui|ux|react|javascript)\s+(?:developer|engineer|designer))\b/i,
    /\b((?:software|web|application)\s+(?:developer|engineer))\b/i
  ];

  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) return clean(match[1]);
  }

  return "";
}

function extractCurrentRole(sections, headline) {
  const experienceLines = sections.experience.slice(0, 12);

  for (const line of experienceLines) {
    if (
      line.length <= 140 &&
      /developer|engineer|designer|manager|analyst|architect|consultant|specialist|lead|frontend|front-end|backend|fullstack|full-stack|software|web|ui|ux/i.test(line) &&
      !/responsibil|developed|built|worked|implemented|created|collaborated|optimized/i.test(line)
    ) {
      return line
        .split(/\s+[|–—]\s+|\s+-\s+/)[0]
        .trim();
    }
  }

  const summaryRole = roleFromSummary(sections.summary.join(" "));
  if (summaryRole) return summaryRole;

  if (headline) {
    return headline.split("|")[0].trim();
  }

  return "";
}

function splitSkillLine(line) {
  let value = clean(line);

  // "Core Frontend: JavaScript, HTML, CSS" -> values only.
  if (value.includes(":")) {
    const parts = value.split(":");
    if (parts.length >= 2 && parts[0].length <= 45) {
      value = parts.slice(1).join(":");
    }
  }

  return value
    .split(/[,|•·;]/)
    .map((item) => clean(item))
    .filter((item) => {
      if (!item || item.length > 80) return false;
      if (/^(and|or|tools?|frameworks?|libraries?)$/i.test(item)) return false;
      return true;
    });
}

function extractSkills(sections) {
  const output = [];

  for (const line of sections.skills) {
    const items = splitSkillLine(line);

    if (items.length > 1) {
      output.push(...items);
    } else if (
      items.length === 1 &&
      items[0].length <= 45 &&
      !/[.!?]$/.test(items[0])
    ) {
      output.push(items[0]);
    }
  }

  return unique(output).slice(0, 60);
}

function compactSection(sectionLines, maxLines = 12) {
  return unique(
    sectionLines
      .map((line) => clean(line))
      .filter((line) => line.length >= 3)
  ).slice(0, maxLines);
}

function extractEducation(sections) {
  const src = sections.education;
  if (!src.length) return [];

  const output = [];
  let current = "";

  for (const line of src) {
    const isDegreeLine = /b\.?tech|bachelor|master|m\.?tech|bca|mca|bsc|msc|mba|degree|diploma|university|college|institute/i.test(line);

    if (!current) {
      current = line;
      continue;
    }

    if (isDegreeLine && current.length > 40) {
      output.push(current);
      current = line;
    } else if ((current + " · " + line).length <= 240) {
      current += " · " + line;
    } else {
      output.push(current);
      current = line;
    }
  }

  if (current) output.push(current);
  return unique(output).slice(0, 8);
}

function extractProjects(sections) {
  const src = sections.projects;
  if (!src.length) return [];

  const output = [];
  let current = "";

  for (const line of src) {
    const likelyProjectTitle =
      line.length <= 120 &&
      !/^(built|developed|implemented|created|designed|integrated|used|features?|responsibil)/i.test(line);

    if (!current) {
      current = line;
      continue;
    }

    if (likelyProjectTitle && current.length > 160) {
      output.push(current);
      current = line;
    } else if ((current + " — " + line).length <= 360) {
      current += " — " + line;
    } else {
      output.push(current);
      current = line;
    }
  }

  if (current) output.push(current);
  return unique(output).slice(0, 12);
}

function extractKeywords(skills, currentRole, headline) {
  const roleTerms = [currentRole];

  if (headline) {
    roleTerms.push(
      ...headline
        .split("|")
        .map((item) => clean(item))
        .filter((item) => item.length <= 45)
    );
  }

  return unique([...roleTerms, ...skills]).slice(0, 35);
}

export function extractLocalProfileFromResume(text) {
  const sections = splitSections(text);
  const name = extractName(sections);
  const headline = extractHeadline(sections, name);
  const currentRole = extractCurrentRole(sections, headline);
  const totalExperienceMonths = extractExperienceMonths(text);
  const skills = extractSkills(sections);
  const education = extractEducation(sections);
  const projects = extractProjects(sections);
  const certifications = compactSection(sections.certifications, 10);
  const targetRoles = currentRole ? [currentRole] : [];
  const resumeKeywords = extractKeywords(skills, currentRole, headline);

  const extractedFields = [
    name,
    headline,
    currentRole,
    totalExperienceMonths > 0,
    skills.length,
    education.length,
    projects.length,
    certifications.length
  ].filter(Boolean).length;

  return {
    name,
    headline,
    currentRole,
    totalExperienceMonths,
    skills,
    workExperience: [],
    education,
    projects,
    certifications,
    suggestedTargetRoles: targetRoles,
    targetRoles,
    resumeKeywords,
    source: "local-resume-parser",
    localExtraction: {
      extractedFields,
      skillsFound: skills.length,
      educationFound: education.length,
      projectsFound: projects.length,
      certificationsFound: certifications.length
    }
  };
}
