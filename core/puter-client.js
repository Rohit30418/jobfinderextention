import {
  clearPuterToken,
  getAiAuthorized,
  getPuterToken,
  setAiAuthorized,
  setPuterToken
} from "./storage.js";
import { normalizeAiProfile } from "./profile-normalizer.js";

const GUI_ORIGIN = "https://puter.com";
const API_ORIGIN = "https://api.puter.com";
const AI_PERMISSION = "driver:puter-chat-completion:complete";

function popupFeatures(width, height) {
  const left = Math.max(0, Math.round((screen.width - width) / 2));
  const top = Math.max(0, Math.round((screen.height - height) / 2));
  return "popup=yes,width=" + width + ",height=" + height + ",left=" + left + ",top=" + top;
}

function waitForPopup(options) {
  return new Promise((resolve, reject) => {
    const popup = window.open(options.url, options.name, popupFeatures(620, 720));

    if (!popup) {
      reject(new Error("The Puter popup was blocked by Chrome."));
      return;
    }

    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearInterval(closeWatcher);
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      callback(value);
    };

    const onMessage = (event) => {
      if (event.origin !== GUI_ORIGIN) return;
      if (event.source !== popup) return;

      const result = options.isValidMessage(event.data || {});
      if (!result) return;

      try {
        popup.close();
      } catch (_) {}

      if (result.error) {
        finish(reject, new Error(result.error));
      } else {
        finish(resolve, result.value);
      }
    };

    window.addEventListener("message", onMessage);

    const closeWatcher = setInterval(() => {
      if (popup.closed) {
        finish(reject, new Error("The Puter popup was closed before finishing."));
      }
    }, 250);

    const timeout = setTimeout(() => {
      try {
        popup.close();
      } catch (_) {}
      finish(reject, new Error("Puter did not respond in time."));
    }, options.timeoutMs || 300000);
  });
}

export async function connectPuter() {
  const msgId = crypto.randomUUID();
  const url =
    GUI_ORIGIN +
    "/action/sign-in?embedded_in_popup=true&request_auth=true&msg_id=" +
    encodeURIComponent(msgId);

  const token = await waitForPopup({
    url,
    name: "jobpilot-puter-login",
    isValidMessage(data) {
      if (data.msg !== "puter.token" || String(data.msg_id) !== String(msgId)) {
        return null;
      }

      if (data.success !== true || !data.token) {
        return { error: "Puter sign-in was not completed." };
      }

      return { value: data.token };
    }
  });

  await setPuterToken(token);
  await setAiAuthorized(false);
  return true;
}

export async function disconnectPuter() {
  await clearPuterToken();
}

export async function authorizePuterAi() {
  const token = await getPuterToken();

  if (!token) {
    throw new Error("Connect Puter first.");
  }

  const msgId = crypto.randomUUID();
  const url =
    GUI_ORIGIN +
    "/action/request-permission?embedded_in_popup=true&msg_id=" +
    encodeURIComponent(msgId) +
    "&permission=" +
    encodeURIComponent(AI_PERMISSION);

  const granted = await waitForPopup({
    url,
    name: "jobpilot-puter-permission",
    isValidMessage(data) {
      if (String(data.original_msg_id) !== String(msgId)) {
        return null;
      }

      if (data.msg !== "permissionGranted") {
        return null;
      }

      return { value: data.granted === true };
    }
  });

  await setAiAuthorized(granted === true);

  if (!granted) {
    throw new Error("Puter AI permission was not granted.");
  }

  return true;
}

function responseText(result) {
  if (!result) return "";

  if (typeof result === "string") return result;

  const content =
    result.message && result.message.content !== undefined
      ? result.message.content
      : result.content !== undefined
        ? result.content
        : "";

  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        if (part && part.text && typeof part.text.value === "string") return part.text.value;
        return "";
      })
      .join("\n");
  }

  return "";
}

function extractJson(text) {
  const fence = String.fromCharCode(96).repeat(3);
  let cleaned = String(text || "").trim();

  if (cleaned.toLowerCase().startsWith(fence + "json")) {
    cleaned = cleaned.slice((fence + "json").length).trim();
  } else if (cleaned.startsWith(fence)) {
    cleaned = cleaned.slice(fence.length).trim();
  }

  if (cleaned.endsWith(fence)) {
    cleaned = cleaned.slice(0, -fence.length).trim();
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("AI did not return a JSON profile.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function callPuterAi(prompt) {
  const token = await getPuterToken();
  const authorized = await getAiAuthorized();

  if (!token) {
    throw new Error("Connect Puter first.");
  }

  if (!authorized) {
    throw new Error("Authorize Puter AI first.");
  }

  const response = await fetch(API_ORIGIN + "/drivers/call", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "text/plain;actually=json"
    },
    body: JSON.stringify({
      interface: "puter-chat-completion",
      driver: "ai-chat",
      method: "complete",
      args: {
        messages: [
          {
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 3000
      },
      auth_token: token
    })
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch (_) {
    throw new Error("Puter returned an unreadable response.");
  }

  if (response.status === 401 || (payload && payload.code === "token_auth_failed")) {
    await clearPuterToken();
    throw new Error("Puter session expired. Connect Puter again.");
  }

  if (payload && payload.success === false) {
    const code =
      payload.error && payload.error.code
        ? payload.error.code
        : payload.code;

    if (code === "permission_denied") {
      await setAiAuthorized(false);
      throw new Error("Puter AI permission is no longer available. Authorize it again.");
    }

    throw new Error(
      payload.error && payload.error.message
        ? payload.error.message
        : payload.message || "Puter AI request failed."
    );
  }

  if (!response.ok) {
    throw new Error("Puter AI request failed with HTTP " + response.status + ".");
  }

  return payload && payload.result !== undefined ? payload.result : payload;
}

export async function analyzeResumeWithAi(resumeText) {
  const safeText = String(resumeText || "").slice(0, 40000);

  const prompt = [
    "You are extracting a candidate profile from a resume for a universal job-search tool.",
    "Extract facts only. Do not invent skills, employers, dates, education, projects, certifications, seniority, or experience.",
    "If a field is unknown, use an empty string, zero, or an empty array.",
    "Return ONLY one valid JSON object. No markdown.",
    "Schema:",
    "{",
    "  \"name\": \"\",",
    "  \"headline\": \"\",",
    "  \"currentRole\": \"\",",
    "  \"totalExperienceMonths\": 0,",
    "  \"skills\": [],",
    "  \"workExperience\": [{\"company\":\"\",\"title\":\"\",\"startDate\":\"\",\"endDate\":\"\",\"description\":\"\",\"skillsUsed\":[]}],",
    "  \"education\": [{\"qualification\":\"\",\"institution\":\"\",\"year\":\"\",\"details\":\"\"}],",
    "  \"projects\": [{\"name\":\"\",\"description\":\"\",\"skillsUsed\":[]}],",
    "  \"certifications\": [],",
    "  \"suggestedTargetRoles\": [],",
    "  \"resumeKeywords\": []",
    "}",
    "Suggested target roles must be reasonable based on the actual resume, not aspirational guesses.",
    "Resume text:",
    safeText
  ].join("\n");

  const result = await callPuterAi(prompt);
  const parsed = extractJson(responseText(result));
  return normalizeAiProfile(parsed);
}


function cleanAiString(value, max = 1200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanAiList(value, maxItems = 40, maxLength = 300) {
  const input = Array.isArray(value) ? value : [];
  const seen = new Set();
  const output = [];

  for (const item of input) {
    const text = cleanAiString(item, maxLength);
    if (!text) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(text);

    if (output.length >= maxItems) break;
  }

  return output;
}

function normalizeJobAiAnalysis(raw) {
  const source = raw && typeof raw === "object" ? raw : {};

  return {
    roleFamily: cleanAiString(source.roleFamily, 180),
    seniority: cleanAiString(source.seniority, 120),
    domain: cleanAiString(source.domain, 180),

    requiredSkills: cleanAiList(source.requiredSkills, 40, 120),
    preferredSkills: cleanAiList(source.preferredSkills, 30, 120),

    mustHaveRequirements: cleanAiList(source.mustHaveRequirements, 30, 500),
    niceToHaveRequirements: cleanAiList(source.niceToHaveRequirements, 25, 500),
    responsibilities: cleanAiList(source.responsibilities, 35, 500),
    disqualifiers: cleanAiList(source.disqualifiers, 20, 500),

    educationRequirements: cleanAiList(source.educationRequirements, 15, 500),
    workMode: cleanAiString(source.workMode, 120),
    employmentType: cleanAiString(source.employmentType, 120),

    experience: {
      minYears:
        Number.isFinite(Number(source.experience?.minYears))
          ? Number(source.experience.minYears)
          : null,
      maxYears:
        Number.isFinite(Number(source.experience?.maxYears))
          ? Number(source.experience.maxYears)
          : null,
      text: cleanAiString(source.experience?.text, 180)
    },

    summary: cleanAiString(source.summary, 1200),

    evidence: {
      roleFamily: cleanAiList(source.evidence?.roleFamily, 5, 220),
      seniority: cleanAiList(source.evidence?.seniority, 5, 220),
      requiredSkills: cleanAiList(source.evidence?.requiredSkills, 12, 220),
      preferredSkills: cleanAiList(source.evidence?.preferredSkills, 12, 220),
      mustHaveRequirements: cleanAiList(source.evidence?.mustHaveRequirements, 12, 220),
      disqualifiers: cleanAiList(source.evidence?.disqualifiers, 8, 220)
    },

    analyzedAt: new Date().toISOString(),
    source: "puter-ai"
  };
}

export async function analyzeJobWithAi(job) {
  const safeJob = job && typeof job === "object" ? job : {};

  const payload = {
    portal: cleanAiString(safeJob.portal, 80),
    title: cleanAiString(safeJob.title, 300),
    company: cleanAiString(safeJob.company, 300),
    experienceText: cleanAiString(safeJob.experienceText, 300),
    location: cleanAiString(safeJob.location, 500),
    salaryText: cleanAiString(safeJob.salaryText, 300),
    skills: cleanAiList(safeJob.skills, 60, 140),
    employmentType: cleanAiString(safeJob.employmentType, 180),
    workMode: cleanAiString(safeJob.workMode, 180),
    education: cleanAiString(safeJob.education, 1200),
    requirementStatements: cleanAiList(safeJob.requirementStatements, 50, 700),
    preferredStatements: cleanAiList(safeJob.preferredStatements, 40, 700),
    responsibilities: cleanAiList(safeJob.responsibilities, 50, 700),
    description: String(safeJob.description || "").slice(0, 24000)
  };

  if (!payload.title && !payload.description) {
    throw new Error("The job detail is not ready for AI analysis yet.");
  }

  const prompt = [
    "You are a job-description interpreter inside a universal job-search browser extension.",
    "Your job is to STRUCTURE the supplied job posting, not to score the candidate and not to invent facts.",
    "Use only evidence present in JOB_DATA below.",
    "Portal facts such as title, company, location, salary, and experience are authoritative and must not be rewritten.",
    "If the JD does not clearly support a field, return an empty string, null, or empty array.",
    "Distinguish required skills from preferred/nice-to-have skills.",
    "A technology merely mentioned in a responsibility is not automatically required.",
    "Disqualifiers must only contain explicit hard constraints such as mandatory years, mandatory degree, location/work-mode restriction, certification, notice period, citizenship, language, or other stated must-have condition.",
    "Return ONLY one valid JSON object. No markdown.",
    "Schema:",
    "{",
    '  "roleFamily": "",',
    '  "seniority": "",',
    '  "domain": "",',
    '  "requiredSkills": [],',
    '  "preferredSkills": [],',
    '  "mustHaveRequirements": [],',
    '  "niceToHaveRequirements": [],',
    '  "responsibilities": [],',
    '  "disqualifiers": [],',
    '  "educationRequirements": [],',
    '  "workMode": "",',
    '  "employmentType": "",',
    '  "experience": {"minYears": null, "maxYears": null, "text": ""},',
    '  "summary": "",',
    '  "evidence": {',
    '    "roleFamily": [],',
    '    "seniority": [],',
    '    "requiredSkills": [],',
    '    "preferredSkills": [],',
    '    "mustHaveRequirements": [],',
    '    "disqualifiers": []',
    "  }",
    "}",
    "Evidence entries should be short phrases copied or tightly paraphrased from the supplied JD.",
    "Do NOT compare this job to any candidate.",
    "Do NOT produce a match percentage.",
    "JOB_DATA:",
    JSON.stringify(payload)
  ].join("\n");

  const result = await callPuterAi(prompt);
  const parsed = extractJson(responseText(result));
  return normalizeJobAiAnalysis(parsed);
}
