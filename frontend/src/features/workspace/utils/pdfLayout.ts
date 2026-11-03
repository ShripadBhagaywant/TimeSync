// CSS uses the browser's 96 CSS pixels per inch; PDF coordinates use millimetres.
export const PDF_PAGE = {
  width: 210,
  height: 297,
  marginX: 18,
  bodyTop: 34,
  bodyBottom: 278,
} as const;
export const PX_PER_MM = 96 / 25.4;
export const PDF_BODY_HEIGHT =
  (PDF_PAGE.bodyBottom - PDF_PAGE.bodyTop) * PX_PER_MM;

export const PDF_STYLES = `
* { box-sizing: border-box; }
html, body { margin:0; padding:0; background:#fff; }
body { font-family: "TimeSync PDF Poppins", "Nirmala UI", Arial, sans-serif; color:#1e293b; }
.pdf-page { position:relative; width:210mm; height:297mm; background:#fff; border-top:2mm solid #2563eb; }
.pdf-header { position:absolute; top:8mm; left:18mm; right:18mm; height:21mm; border-bottom:1px solid #e2e8f0; }
.pdf-header-row, .pdf-footer { display:flex; justify-content:space-between; gap:12px; }
.pdf-brand { color:#1e293b; font-weight:700; font-size:10pt; }
.pdf-date { color:#64748b; font-size:8pt; }
.pdf-running-title { font-size:8pt; line-height:1.3; color:#64748b; overflow-wrap:anywhere; max-height:12mm; overflow:hidden; margin-top:6px; }
.pdf-footer { position:absolute; left:18mm; right:18mm; bottom:7mm; border-top:1px solid #e2e8f0; padding-top:4mm; color:#64748b; font-size:8pt; }
.pdf-body { position:absolute; top:32mm; left:18mm; right:18mm; height:244mm; }
.pdf-flow { display:flow-root; min-width:0; max-width:100%; font-size:10.5pt; line-height:1.6; overflow-wrap:anywhere; }
.pdf-flow p, .pdf-flow a, .pdf-flow h1, .pdf-flow h2, .pdf-flow h3, .pdf-flow h4, .pdf-flow h5, .pdf-flow h6 { min-width:0; max-width:100%; overflow-wrap:anywhere; word-break:break-word; }
.pdf-flow > :first-child { margin-top:0; }
.pdf-flow > :last-child { margin-bottom:0; }
.pdf-flow p { margin:0 0 10px; orphans:3; widows:3; }
.pdf-flow p,
.pdf-callout-content {
  text-align: justify;
}
.pdf-flow li, .pdf-flow td, .pdf-flow th { text-align:left; }
.pdf-flow li p { text-align:left; }
.pdf-flow h1, .pdf-flow h2, .pdf-flow h3, .pdf-flow h4, .pdf-flow h5, .pdf-flow h6 { font-weight:600; line-height:1.35; color:#0f172a; break-after:avoid; margin:18px 0 9px; }
.pdf-flow h1 strong, .pdf-flow h2 strong, .pdf-flow h3 strong { font-weight:inherit; }
.pdf-flow h1 { font-size:22pt; } .pdf-flow h2 { font-size:17pt; } .pdf-flow h3 { font-size:13pt; }
.pdf-title-card { padding:18px 20px; margin-bottom:18px; background:#eff6ff; border:1px solid #bfdbfe; border-left:5px solid #2563eb; border-radius:12px; break-inside:avoid; }
.pdf-title-card h1 { max-width:100%; overflow-wrap:anywhere; word-break:break-word; font-size:21pt; line-height:1.3; margin:8px 0 14px; }
.pdf-eyebrow { font-size:8pt; font-weight:700; color:#2563eb; letter-spacing:1px; }
.pdf-title-meta { font-size:8pt; color:#64748b; }
.pdf-flow ul, .pdf-flow ol { padding-left:25px; margin:8px 0 12px; }
.pdf-flow li { padding-left:3px; margin-bottom:6px; }
.pdf-flow li p { margin-bottom:5px; }
.pdf-flow li.pdf-list-continuation { list-style-type:none; }
.pdf-flow ul ul, .pdf-flow ol ol, .pdf-flow li ul, .pdf-flow li ol { margin:5px 0; }
.pdf-flow code { font-family:Consolas, "Courier New", monospace; font-size:.91em; padding:0 1px; background:transparent; border:0; }
.pdf-flow pre { white-space:pre-wrap; overflow-wrap:anywhere; margin:12px 0; padding:12px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:6px; font-size:9pt; line-height:1.5; }
.pdf-flow pre code { padding:0; background:transparent; font-size:inherit; }
.pdf-flow blockquote, .pdf-callout { margin:12px 0; padding:12px 15px; border-left:3px solid #2563eb; background:#f8fafc; }
.pdf-callout-label { font-weight:600; color:#1d4ed8; margin-bottom:5px; }
.pdf-flow blockquote p:last-child, .pdf-callout-content p:last-child { margin-bottom:0; }
.pdf-flow hr { border:0; border-top:1px solid #cbd5e1; margin:14px 0; }
.pdf-flow table { width:100%; table-layout:fixed; border-collapse:collapse; margin:12px 0; font-size:9pt; }
.pdf-flow th, .pdf-flow td { border:1px solid #cbd5e1; padding:7px; vertical-align:top; overflow-wrap:anywhere; }
.pdf-flow th { background:#eff6ff; color:#1e3a8a; font-weight:600; }
.pdf-flow img { display:block; max-width:100%; max-height:215mm; width:auto; height:auto; object-fit:contain; margin:10px auto; }
.pdf-flow a { color:#1d4ed8; text-decoration:underline; }
.pdf-flow [data-indent] { max-width:100%; }
.pdf-flow [data-type="timestamp"] { color:#2563eb; font-size:.9em; }
.pdf-flow [data-type="timestamp"]:empty::before { content:attr(timestamp); }
.pdf-measure { position:absolute; left:0; top:0; width:174mm; visibility:hidden; }
`;

export const createPdfPage = (
  doc: Document,
  title: string,
  date: string,
): HTMLElement => {
  const page = doc.createElement("section");
  page.className = "pdf-page";
  page.innerHTML =
    '<header class="pdf-header"><div class="pdf-header-row"><span class="pdf-brand">TimeSync Notes</span><span class="pdf-date"></span></div><div class="pdf-running-title"></div></header><main class="pdf-body"><div class="pdf-flow"></div></main><footer class="pdf-footer"><span>Personal Learning Workspace</span><span class="pdf-page-number"></span></footer>';
  page.querySelector(".pdf-running-title")!.textContent = title;
  page.querySelector(".pdf-date")!.textContent = `Exported: ${date}`;
  return page;
};

export const createPdfTitle = (
  doc: Document,
  title: string,
  date: string,
  videoId?: string,
): HTMLElement => {
  const card = doc.createElement("div");
  card.className = "pdf-title-card";
  card.innerHTML =
    '<div class="pdf-eyebrow">TIMESYNC NOTES</div><h1></h1><div class="pdf-title-meta"></div>';
  card.querySelector("h1")!.textContent = title || "Untitled Notes";
  card.querySelector(".pdf-title-meta")!.textContent = [
    "Structured study notes",
    videoId ? `Video ${videoId}` : "",
    date,
  ]
    .filter(Boolean)
    .join(" · ");
  return card;
};
