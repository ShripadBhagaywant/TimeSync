import regular from "@/assets/fonts/poppins/Poppins-Regular.ttf?url";
import semibold from "@/assets/fonts/poppins/Poppins-SemiBold.ttf?url";
import bold from "@/assets/fonts/poppins/Poppins-Bold.ttf?url";

export const PDF_FONT_FAMILY = "TimeSync PDF Poppins";
const faces = [[400, regular], [600, semibold], [700, bold]] as const;

/** Same-origin assets: no external font service or font swap during pagination. */
export const loadPdfFonts = async (doc: Document): Promise<void> => {
  if (!doc.querySelector("style[data-pdf-fonts]")) {
    const style = doc.createElement("style");
    style.dataset.pdfFonts = "true";
    style.textContent = faces.map(([weight, url]) =>
      `@font-face{font-family:"${PDF_FONT_FAMILY}";font-style:normal;font-weight:${weight};src:url("${url}") format("truetype");}`,
    ).join("\n");
    doc.head.append(style);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(faces.map(async ([weight]) => {
        const loaded = await doc.fonts.load(`${weight} 16px "${PDF_FONT_FAMILY}"`, "Notes हिंदी");
        if (!loaded.length) throw new Error("PDF font could not be loaded");
      })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("PDF font loading timed out")), 10000);
      }),
    ]);
  } finally { clearTimeout(timer); }
};
