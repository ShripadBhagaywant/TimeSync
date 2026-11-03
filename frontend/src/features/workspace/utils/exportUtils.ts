import { notify } from "@/lib/toast";
import { getDraft } from "@/lib/indexDB";
import { htmlToMarkdown, htmlToPlainText } from "./exportConversions";

import type { PdfExportOptions } from "./pdfExport";

export type ExportFormat = "pdf" | "markdown" | "text";

/**
 * The live editor is authoritative while a debounced local save is pending.
 * Read storage only when the caller has no editor snapshot.
 */
export const getLatestDraftContent = async (
  videoId?: string,
  fallbackHtml?: string,
): Promise<string> => {
  if (fallbackHtml !== undefined) return fallbackHtml;
  if (!videoId) return "";

  try {
    const draft = await getDraft(videoId);
    if (draft && typeof draft.content === "string" && draft.content.trim()) {
      return draft.content;
    }
  } catch {
    console.warn("Could not read the saved draft for export.");
  }

  return "";
};

/**
 * Main Export Handler
 */
export const exportDocument = async (
  title: string,
  htmlContent: string,
  format: ExportFormat,
  videoId?: string,
  options?: PdfExportOptions,
): Promise<void> => {
  const sanitizedTitle = (title || "notes").toLowerCase().replace(/\s+/g, "-");
  const fullHtml = await getLatestDraftContent(videoId, htmlContent);

  options?.signal?.throwIfAborted();
  switch (format) {
    case "markdown": {
      const mdContent = htmlToMarkdown(title, fullHtml);
      downloadBlob(
        mdContent,
        `${sanitizedTitle}.md`,
        "text/markdown;charset=utf-8",
      );
      notify.success("Export Complete", "Exported notes as Markdown (.md)");
      break;
    }

    case "text": {
      const plainText = htmlToPlainText(title, fullHtml);

      downloadBlob(
        plainText,
        `${sanitizedTitle}.txt`,
        "text/plain;charset=utf-8",
      );
      notify.success("Export Complete", "Exported notes as Plain Text (.txt)");
      break;
    }

    case "pdf": {
      const { exportPdf } = await import("./pdfExport");
      await exportPdf(title, fullHtml, sanitizedTitle, videoId, options);
      break;
    }

    default:
      notify.error("Export Failed", "Unsupported format selected.");
  }
};

const downloadBlob = (
  content: string,
  filename: string,
  contentType: string,
) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
