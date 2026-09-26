function extensionOf(file) {
  const name = String(file && file.name ? file.name : "").toLowerCase();
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1) : "";
}

async function parsePdf(file) {
  if (!globalThis.pdfjsLib) {
    throw new Error("PDF.js is not loaded.");
  }

  globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("vendor/pdf.worker.min.js");

  const data = new Uint8Array(await file.arrayBuffer());
  const task = globalThis.pdfjsLib.getDocument({ data, isEvalSupported: false });
  const pdf = await task.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (item && typeof item.str === "string" ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    pages.push(text);
  }

  return {
    text: pages.join("\n\n"),
    parser: "pdf.js",
    details: { pages: pdf.numPages }
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

  return {
    text: paragraphs.join("\n"),
    parser: "docx-local",
    details: { paragraphs: paragraphs.length }
  };
}

async function parsePlainText(file) {
  return {
    text: await file.text(),
    parser: "plain-text",
    details: {}
  };
}

export async function parseResumeFile(file) {
  if (!file) {
    throw new Error("Choose a resume file first.");
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
