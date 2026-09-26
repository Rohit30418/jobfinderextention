function extensionOf(file) {
  const name = String(file && file.name ? file.name : "").toLowerCase();
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1) : "";
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function hasPdfHeader(file) {
  const header = await file.slice(0, 8).arrayBuffer();
  const text = new TextDecoder("latin1").decode(header);
  return text.startsWith("%PDF-");
}

function configurePdfWorker() {
  const pdfjs = globalThis.pdfjsLib;

  if (!pdfjs) {
    throw new Error("PDF.js library is missing.");
  }

  if (!globalThis.pdfjsWorker || !globalThis.pdfjsWorker.WorkerMessageHandler) {
    throw new Error("PDF.js worker engine is missing.");
  }

  // The worker engine is loaded locally on the extension page.
  // PDF.js detects it and uses its built-in same-page worker bridge,
  // avoiding Chrome-extension Web Worker handshake issues.
  pdfjs.GlobalWorkerOptions.workerPort = null;
  pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("vendor/pdf.worker.min.js");
}

function pageTextFromItems(items) {
  const lines = [];
  let current = [];

  for (const item of items || []) {
    if (!item || typeof item.str !== "string") {
      continue;
    }

    const value = item.str.trim();

    if (value) {
      current.push(value);
    }

    if (item.hasEOL) {
      if (current.length) {
        lines.push(current.join(" "));
        current = [];
      }
    }
  }

  if (current.length) {
    lines.push(current.join(" "));
  }

  return lines.join("\n").trim();
}

async function parsePdf(file) {
  if (!await hasPdfHeader(file)) {
    throw new Error("This file does not appear to be a valid PDF.");
  }

  configurePdfWorker();

  const pdfjs = globalThis.pdfjsLib;
  const data = new Uint8Array(await file.arrayBuffer());

  const task = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableFontFace: true,
    useWorkerFetch: false,
    stopAtErrors: false
  });

  let pdf;

  try {
    pdf = await withTimeout(
      task.promise,
      12000,
      "PDF extraction timed out unexpectedly. Open Developer diagnostics and retry once."
    );
  } catch (error) {
    try {
      await task.destroy();
    } catch (_) {}

    const message = error && error.message ? error.message : String(error || "");

    if (/password/i.test(message)) {
      throw new Error("This PDF is password protected. Please upload an unlocked copy.");
    }

    throw new Error("PDF.js could not read this PDF: " + message);
  }

  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await withTimeout(
        pdf.getPage(pageNumber),
        10000,
        "Timed out while opening PDF page " + pageNumber + "."
      );

      const content = await withTimeout(
        page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        }),
        10000,
        "Timed out while extracting text from PDF page " + pageNumber + "."
      );

      pages.push(pageTextFromItems(content.items));
      page.cleanup();
    }
  } finally {
    try {
      await pdf.destroy();
    } catch (_) {}
  }

  const text = pages.filter(Boolean).join("\n\n").trim();

  if (!text) {
    throw new Error(
      "No selectable text was found in this PDF. It may be scanned/image-only. Use Paste Resume Text for now."
    );
  }

  return {
    text,
    parser: "pdf.js-worker",
    details: {
      pages: pages.length,
      worker: "same-page-pdfjs-worker-engine"
    }
  };
}

function findEndOfCentralDirectory(view) {
  const min = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This Chrome version cannot decompress DOCX files. Use Paste Resume Text instead.");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractZipEntry(buffer, wantedName) {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);

  if (eocd < 0) {
    throw new Error("The DOCX ZIP directory could not be found.");
  }

  const entries = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder("utf-8");
  let offset = centralOffset;

  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("The DOCX ZIP directory is invalid.");
    }

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameBytes = new Uint8Array(buffer, offset + 46, fileNameLength);
    const fileName = decoder.decode(nameBytes);

    if (fileName === wantedName) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error("The DOCX entry header is invalid.");
      }

      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = new Uint8Array(buffer, dataStart, compressedSize);

      if (method === 0) {
        return compressed;
      }

      if (method === 8) {
        return inflateRaw(compressed);
      }

      throw new Error("Unsupported DOCX compression method.");
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error("word/document.xml was not found in this DOCX.");
}

async function parseDocx(file) {
  const buffer = await file.arrayBuffer();
  const xmlBytes = await extractZipEntry(buffer, "word/document.xml");
  const xml = new TextDecoder("utf-8").decode(xmlBytes);
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("The DOCX document XML could not be parsed.");
  }

  const paragraphs = Array.from(doc.getElementsByTagNameNS("*", "p"))
    .map((paragraph) => paragraph.textContent.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    throw new Error("No readable text was found in this DOCX.");
  }

  return {
    text: paragraphs.join("\n"),
    parser: "docx-local",
    details: { paragraphs: paragraphs.length }
  };
}

async function parsePlainText(file) {
  const text = await file.text();

  if (!text.trim()) {
    throw new Error("This text file is empty.");
  }

  return {
    text,
    parser: "plain-text",
    details: {}
  };
}

export async function parseResumeFile(file) {
  if (!file) {
    throw new Error("Choose a resume file first.");
  }

  if (file.size <= 0) {
    throw new Error("The selected resume file is empty.");
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Resume file is too large. Please use a file under 15 MB.");
  }

  const extension = extensionOf(file);

  if (extension === "pdf" || file.type === "application/pdf") {
    return parsePdf(file);
  }

  if (
    extension === "docx" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return parseDocx(file);
  }

  if (extension === "txt" || extension === "md" || String(file.type || "").startsWith("text/")) {
    return parsePlainText(file);
  }

  throw new Error("Unsupported file type. Use PDF, DOCX, TXT or MD.");
}
