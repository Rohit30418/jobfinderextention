function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

export function normalizeResumeText(input) {
  return String(input || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function validateResumeText(input) {
  const text = normalizeResumeText(input);
  const charCount = text.length;
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}+#./&'_-]*/gu) || [];
  const wordCount = words.length;
  const letterCount = countMatches(text, /\p{L}/gu);
  const digitCount = countMatches(text, /\p{N}/gu);
  const whitespaceCount = countMatches(text, /\s/g);
  const replacementCount = countMatches(text, /\uFFFD/g);
  const controlCount = countMatches(text, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g);
  const commonPunctuationCount = countMatches(text, /[.,;:!?@#%&()+\-_/\\'"[\]{}]/g);
  const symbolCount = Math.max(0, charCount - letterCount - digitCount - whitespaceCount - commonPunctuationCount);
  const singleCharWords = words.filter((word) => word.length === 1).length;
  const longWords = words.filter((word) => word.length > 35).length;

  const alphaRatio = charCount ? letterCount / charCount : 0;
  const printableRatio = charCount ? (charCount - controlCount - replacementCount) / charCount : 0;
  const symbolRatio = charCount ? symbolCount / charCount : 1;
  const singleWordRatio = wordCount ? singleCharWords / wordCount : 1;
  const longWordRatio = wordCount ? longWords / wordCount : 1;

  const lower = text.toLowerCase();
  const headingSignals = [
    "experience", "education", "skills", "summary", "profile", "projects",
    "employment", "work history", "qualifications", "certifications",
    "professional experience", "career"
  ].filter((item) => lower.includes(item)).length;

  const contactSignals = [
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text),
    /(?:linkedin\.com|github\.com|portfolio|behance|dribbble)/i.test(text),
    /(?:\+?\d[\d\s().-]{7,}\d)/.test(text)
  ].filter(Boolean).length;

  let score = 100;
  const issues = [];
  const positives = [];

  if (charCount < 200) {
    score -= 40;
    issues.push("Too little readable text was extracted.");
  } else {
    positives.push("Useful amount of text extracted.");
  }

  if (wordCount < 40) {
    score -= 35;
    issues.push("Too few words were extracted.");
  } else {
    positives.push("Word count looks reasonable.");
  }

  if (alphaRatio < 0.45) {
    score -= 30;
    issues.push("Text contains too few readable letters.");
  }

  if (printableRatio < 0.97) {
    score -= 30;
    issues.push("Text contains invalid or non-printable characters.");
  }

  if (symbolRatio > 0.16) {
    score -= 30;
    issues.push("Text contains an unusually high symbol/gibberish ratio.");
  }

  if (singleWordRatio > 0.35) {
    score -= 30;
    issues.push("Too many single-character tokens were detected.");
  }

  if (longWordRatio > 0.03) {
    score -= 20;
    issues.push("Unusually long tokens suggest decoding problems.");
  }

  if (replacementCount > 0) {
    score -= 15;
    issues.push("Unicode replacement characters were detected.");
  }

  if (headingSignals >= 2) {
    score += 3;
    positives.push("Resume-like sections were detected.");
  }

  if (contactSignals >= 1) {
    score += 2;
    positives.push("Contact/profile information was detected.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const passed =
    score >= 60 &&
    charCount >= 200 &&
    wordCount >= 40 &&
    alphaRatio >= 0.45 &&
    printableRatio >= 0.97 &&
    symbolRatio <= 0.20 &&
    singleWordRatio <= 0.40;

  return {
    passed,
    score,
    text,
    issues,
    positives,
    metrics: {
      charCount,
      wordCount,
      alphaRatio: round(alphaRatio),
      printableRatio: round(printableRatio),
      symbolRatio: round(symbolRatio),
      singleWordRatio: round(singleWordRatio),
      headingSignals,
      contactSignals
    }
  };
}
