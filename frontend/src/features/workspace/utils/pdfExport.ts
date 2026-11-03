import jsPDF from "jspdf";
import { notify } from "@/lib/toast";
import { normalizePdfHtml, pdfFilename } from "./exportHtmlNormalizer";
import { createPdfTitle, PDF_PAGE, PDF_STYLES, PX_PER_MM } from "./pdfLayout";
import { paginatePdf } from "./pdfPagination";
import { loadPdfFonts } from "./pdfFonts";
import { loadPdfRenderer } from "./pdfRenderer";

export interface PdfExportOptions { delivery?: "download" | "print"; alignment?: "left" | "justify"; signal?: AbortSignal; onProgress?: (message: string) => void; }

const waitForImages = async (root: Element, signal: AbortSignal) => {
  signal.throwIfAborted();
  await Promise.all(Array.from(root.querySelectorAll("img")).map(image => new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      signal.removeEventListener("abort", abort);
    };
    const finish = () => {
      cleanup();
      if (image.naturalWidth) resolve();
      else reject(new Error("An image could not be loaded for PDF export"));
    };
    const abort = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("PDF image loading timed out")); }, 10_000);
    image.addEventListener("load", finish);
    image.addEventListener("error", finish);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else if (image.complete) finish();
  })));
};

const withCancellation = <T,>(work: Promise<T>, signal: AbortSignal): Promise<T> => new Promise((resolve, reject) => {
  const abort = () => reject(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
});

const preparePdfPages = async (title: string, fullHtml: string, videoId?: string, options: PdfExportOptions = {}) => {
  options.signal?.throwIfAborted();
  options.onProgress?.("Preparing fonts and images…");
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.dataset.pdfExport = "true";
  Object.assign(frame.style, {
    position: "fixed", left: "-10000px", top: "0", width: `${PDF_PAGE.width * PX_PER_MM}px`,
    height: `${PDF_PAGE.height * PX_PER_MM}px`, border: "0",
  });
  document.body.append(frame);
  const preparation = new AbortController();
  const abortPreparation = () => preparation.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abortPreparation, { once: true });
  if (options.signal?.aborted) abortPreparation();
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error("Unable to create isolated export frame");
    doc.open();
    doc.write("<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>");
    doc.close();
    const style = doc.createElement("style");
    style.textContent = PDF_STYLES + (options.alignment === "left" ? "\n.pdf-flow p, .pdf-callout-content { text-align:left; }" : "");
    doc.head.append(style);
    const source = normalizePdfHtml(fullHtml, doc);
    source.className = "pdf-flow";
    source.style.width = "174mm";
    const date = new Date().toLocaleDateString();
    const safeTitle = title || "Untitled Notes";
    source.prepend(createPdfTitle(doc, safeTitle, date, videoId));
    source.querySelectorAll("img").forEach((image) => { image.crossOrigin = "anonymous"; });
    doc.body.append(source);
    await Promise.all([withCancellation(loadPdfFonts(doc), preparation.signal), waitForImages(source, preparation.signal)]);
    options.signal?.throwIfAborted();
    options.onProgress?.("Arranging pages…");
    const pages = await paginatePdf(doc, source, safeTitle, date, options.signal);
    source.remove();
    return { frame, doc, pages, safeTitle };
  } catch (error) { preparation.abort(); frame.remove(); throw error; }
  finally { options.signal?.removeEventListener("abort", abortPreparation); }
};

/** Download compatibility path; browser printing below preserves actual text. */
export const buildPdfDocument = async (title: string, fullHtml: string, videoId?: string, options: PdfExportOptions = {}): Promise<jsPDF> => {
  const { frame, doc, pages, safeTitle } = await preparePdfPages(title, fullHtml, videoId, options);
  try {
    const renderPage = await loadPdfRenderer(doc);
    const pdf = new jsPDF("p", "mm", "a4");
    pdf.setProperties({ title: safeTitle, subject: "Exported learning notes", author: "TimeSync Notes" });
    for (const [index, page] of pages.entries()) {
      options.signal?.throwIfAborted();
      options.onProgress?.(`Rendering page ${index + 1} of ${pages.length}…`);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (index) pdf.addPage();
      // At most one A4 raster is allocated at a time. Never crop a document bitmap.
      const canvas = await renderPage(page, {
        scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff",
        windowWidth: Math.ceil(PDF_PAGE.width * PX_PER_MM),
        windowHeight: Math.ceil(PDF_PAGE.height * PX_PER_MM),
        onclone: (clonedDocument) => loadPdfFonts(clonedDocument),
      });
      try {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          (value) => value ? resolve(value) : reject(new Error("PDF page encoding failed")), "image/jpeg", 0.95,
        ));
        pdf.addImage(new Uint8Array(await blob.arrayBuffer()), "JPEG", 0, 0, 210, 297, undefined, "FAST");
        const pageBox = page.getBoundingClientRect();
        page.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
          if (!/^https?:/i.test(link.href)) return;
          for (const rect of link.getClientRects()) {
            pdf.link((rect.left - pageBox.left) / PX_PER_MM, (rect.top - pageBox.top) / PX_PER_MM,
              rect.width / PX_PER_MM, rect.height / PX_PER_MM, { url: link.href });
          }
        });
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
      page.remove();
    }
    options.signal?.throwIfAborted();
    return pdf;
  } finally {
    frame.remove();
  }
};

export const printPdfDocument = async (title: string, fullHtml: string, videoId?: string, options: PdfExportOptions = {}): Promise<void> => {
  const { frame, doc } = await preparePdfPages(title, fullHtml, videoId, options);
  try {
    options.signal?.throwIfAborted();
    doc.title = pdfFilename(title);
    const style = doc.createElement("style");
    style.textContent = "@page { size:A4; margin:0; } @media print { html,body { width:210mm; print-color-adjust:exact; -webkit-print-color-adjust:exact; } .pdf-page { break-after:page; break-inside:avoid; } .pdf-page:last-child { break-after:auto; } }";
    doc.head.append(style);
    const view = doc.defaultView;
    if (!view) throw new Error("Print preview unavailable");
    options.onProgress?.("Choose Save as PDF in the print dialog…");
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { view.removeEventListener("afterprint", finish); options.signal?.removeEventListener("abort", abort); };
      const finish = () => { cleanup(); resolve(); };
      const abort = () => { cleanup(); reject(options.signal?.reason); };
      view.addEventListener("afterprint", finish, { once: true });
      options.signal?.addEventListener("abort", abort, { once: true });
      try { view.focus(); view.print(); } catch (error) { cleanup(); reject(error); }
    });
  } finally { frame.remove(); }
};

export const exportPdf = async (title: string, fullHtml: string, sanitizedTitle: string, videoId?: string, options: PdfExportOptions = {}): Promise<void> => {
  if (options.delivery === "print") {
    await printPdfDocument(title, fullHtml, videoId, options);
    return;
  }
  // The existing export action owns the friendly failure notification.
  const pdf = await buildPdfDocument(title, fullHtml, videoId, options);
  options.signal?.throwIfAborted();
  pdf.save(pdfFilename(sanitizedTitle));
  notify.success("Export Complete", "PDF generated successfully.");
};
