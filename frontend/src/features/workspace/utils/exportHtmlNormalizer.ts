import { sanitizeExportHtml } from "@/lib/noteHtml";

/** Export-only transformations. Never write this HTML back to the editor/draft. */
export const normalizePdfHtml = (html: string, doc: Document): HTMLElement => {
  const raw = new DOMParser().parseFromString(html, "text/html");
  raw
    .querySelectorAll("script, style, iframe, object")
    .forEach((node) => node.remove());
  // The shared sanitizer intentionally omits these attributes. Preserve safe list
  // numbering and rules here without changing other export formats.
  raw.querySelectorAll("hr").forEach((node) => {
    const marker = raw.createElement("p");
    marker.textContent = "---";
    node.replaceWith(marker);
  });
  const root = doc.createElement("div");
  root.innerHTML = sanitizeExportHtml(raw.body.innerHTML);
  const sourceLists = raw.querySelectorAll("ol, li");
  root.querySelectorAll("ol, li").forEach((list, index) => {
    const source = sourceLists[index];
    for (const name of ["start", "value"]) {
      const value = source?.getAttribute(name);
      if (value && /^-?\d{1,6}$/.test(value)) list.setAttribute(name, value);
    }
    if (source?.hasAttribute("reversed")) list.setAttribute("reversed", "");
  });
  root.querySelectorAll("p").forEach((paragraph) => {
    if (paragraph.closest("pre, code")) return;
    if (
      paragraph.textContent?.trim() === "---" &&
      !paragraph.querySelector("code, img")
    ) {
      paragraph.replaceWith(doc.createElement("hr"));
    }
  });
  const markerPattern = /^\[!(NOTE|KEY TAKEAWAY)\]$/i;
  root.querySelectorAll("p").forEach((marker) => {
    if (!root.contains(marker) || marker.closest("pre, code")) return;
    const match = marker.textContent?.trim().match(markerPattern);
    if (!match || marker.querySelector("code, img")) return;
    let body: Element | null = null;
    let replaced: Element = marker;
    if (
      marker.parentElement?.tagName === "BLOCKQUOTE" &&
      marker === marker.parentElement.firstElementChild
    ) {
      body = marker.parentElement;
      replaced = body;
      marker.remove();
    } else {
      let next = marker.nextElementSibling;
      while (
        next?.tagName === "P" &&
        !next.textContent?.trim() &&
        !next.querySelector("img")
      ) {
        next = next.nextElementSibling;
      }
      if (next?.tagName === "BLOCKQUOTE") body = next;
    }
    if (!body) return; // Ordinary bracketed prose is not a callout.
    const callout = doc.createElement("div");
    callout.className = "pdf-callout";
    const label = doc.createElement("div");
    label.className = "pdf-callout-label";
    label.textContent =
      match[1]?.toUpperCase() === "NOTE" ? "Note" : "Key Takeaway";
    const content = doc.createElement("div");
    content.className = "pdf-callout-content";
    content.append(...Array.from(body.childNodes));
    callout.append(label, content);
    replaced.replaceWith(callout);
    body.remove();
  });
  root
    .querySelectorAll("[contenteditable], .ProseMirror-trailingBreak")
    .forEach((node) => {
      node.removeAttribute("contenteditable");
      if (node.classList.contains("ProseMirror-trailingBreak")) node.remove();
    });
  root.querySelectorAll("blockquote").forEach((quote) => {
    if (!quote.textContent?.trim() && !quote.querySelector("img"))
      quote.remove();
  });
  // Already-formatted notes can use a separate quoted label instead of [!NOTE].
  root.querySelectorAll("blockquote").forEach((quote) => {
    const labelText = quote.textContent?.trim();
    if (!/^(NOTE|KEY TAKEAWAY):?$/i.test(labelText || "")) return;
    const next = quote.nextElementSibling;
    if (next?.tagName !== "BLOCKQUOTE") return;
    const callout = doc.createElement("div");
    callout.className = "pdf-callout";
    const label = doc.createElement("div");
    label.className = "pdf-callout-label";
    label.textContent = /^NOTE/i.test(labelText!) ? "Note" : "Key Takeaway";
    const content = doc.createElement("div");
    content.className = "pdf-callout-content";
    content.append(...Array.from(next.childNodes));
    callout.append(label, content);
    quote.replaceWith(callout);
    next.remove();
  });
  // Tiptap notes also contain section labels stored as bold paragraphs.
  root.querySelectorAll("p").forEach((paragraph) => {
    const text = paragraph.textContent?.trim() || "";
    const boldText = Array.from(paragraph.querySelectorAll("strong"))
      .map((node) => node.textContent)
      .join("")
      .trim();
    const markText = Array.from(paragraph.querySelectorAll("mark"))
      .map((node) => node.textContent)
      .join("")
      .trim();
    if (
      text &&
      text.length <= 120 &&
      (text === boldText || text === markText) &&
      paragraph.nextElementSibling
    ) {
      paragraph.classList.add("pdf-keep-next");
    }
  });
  // Make bare text a layout block too.
  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === 3 && node.textContent?.trim()) {
      const paragraph = doc.createElement("p");
      node.replaceWith(paragraph);
      paragraph.append(node);
    }
  });
  return root;
};

export const pdfFilename = (name: string): string => {
  const safe = Array.from(name)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/[. ]+$/g, "")
    .trim();
  const base =
    safe && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)
      ? safe
      : "notes";
  return `${Array.from(base).slice(0, 160).join("")}.pdf`;
};
