import type html2canvas from "html2canvas";
import rendererUrl from "html2canvas/dist/html2canvas.min.js?url";

/** html2canvas measures fonts using its own global document. Run it inside the
 * export frame so application CSS (notably Tailwind's block images) cannot alter
 * its baseline probe or paint text outside the measured line boxes. */
export const loadPdfRenderer = (doc: Document): Promise<typeof html2canvas> => new Promise((resolve, reject) => {
  const script = doc.createElement("script");
  const timer = setTimeout(() => reject(new Error("PDF renderer loading timed out")), 10000);
  script.src = rendererUrl;
  script.onload = () => {
    clearTimeout(timer);
    const renderer = (doc.defaultView as (Window & { html2canvas?: typeof html2canvas }) | null)?.html2canvas;
    if (renderer) resolve(renderer);
    else reject(new Error("PDF renderer unavailable"));
  };
  script.onerror = () => { clearTimeout(timer); reject(new Error("PDF renderer could not be loaded")); };
  doc.head.append(script);
});
