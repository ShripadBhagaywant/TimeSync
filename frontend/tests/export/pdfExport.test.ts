// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import html2canvas from "html2canvas";
import { buildPdfDocument, printPdfDocument } from "@/features/workspace/utils/pdfExport";

vi.mock("html2canvas", () => ({ default: vi.fn() }));
vi.mock("@/features/workspace/utils/pdfRenderer", () => ({ loadPdfRenderer: async () => html2canvas }));
vi.mock("@/features/workspace/utils/pdfFonts", () => ({ loadPdfFonts: vi.fn().mockResolvedValue(undefined) }));
vi.mock("jspdf", () => ({ default: class { setProperties() {} } }));
vi.mock("@/lib/toast", () => ({ notify: { success: vi.fn() } }));
vi.mock("@/features/workspace/utils/pdfPagination", () => ({ paginatePdf: (doc: Document, source: HTMLElement) => { const page = doc.createElement("section"); page.append(...source.childNodes); doc.body.append(page); return [page]; } }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("PDF export failure cleanup", () => {
  it("removes the isolated frame when rendering fails and propagates the error", async () => {
    vi.useFakeTimers();
    vi.mocked(html2canvas).mockRejectedValueOnce(new Error("Rendering failed"));
    const assertion = expect(buildPdfDocument("Notes", "<p>Draft</p>")).rejects.toThrow("Rendering failed");
    await vi.advanceTimersByTimeAsync(3001);
    await assertion;
    expect(document.querySelector("[data-pdf-export]")).toBeNull();
  });

  it("releases the page canvas and frame when encoding fails", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "toBlob").mockImplementation((callback) => callback(null));
    vi.mocked(html2canvas).mockResolvedValueOnce(canvas);
    const assertion = expect(buildPdfDocument("Notes", "<p>Draft</p>")).rejects.toThrow("PDF page encoding failed");
    await vi.advanceTimersByTimeAsync(3001);
    await assertion;
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(document.querySelector("[data-pdf-export]")).toBeNull();
  });
});

it("cancels before allocating an export frame", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(buildPdfDocument("Notes", "<p>Draft</p>", undefined, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(document.querySelector("[data-pdf-export]")).toBeNull();
  expect(html2canvas).not.toHaveBeenCalled();
});

it("reports preparation and page progress", async () => {
  vi.useFakeTimers();
  vi.mocked(html2canvas).mockRejectedValueOnce(new Error("Stop after progress"));
  const progress = vi.fn();
  const assertion = expect(buildPdfDocument("Notes", "<p>Draft</p>", undefined, { onProgress: progress })).rejects.toThrow("Stop after progress");
  await vi.advanceTimersByTimeAsync(3001);
  await assertion;
  expect(progress.mock.calls.flat()).toEqual(["Preparing fonts and images…", "Arranging pages…", "Rendering page 1 of 1…"]);
});

it("prints real text and removes the frame after the print dialog closes", async () => {
  const promise = printPdfDocument("Notes", "<p>Selectable study notes</p>");
  // The font loader resolves immediately in this test; wait for print setup.
  const frame = document.querySelector<HTMLIFrameElement>("[data-pdf-export]")!;
  const print = vi.spyOn(frame.contentWindow!, "print").mockImplementation(() => {
    expect(frame.contentDocument!.body.textContent).toContain("Selectable study notes");
    frame.contentWindow!.dispatchEvent(new Event("afterprint"));
  });
  vi.spyOn(frame.contentWindow!, "focus").mockImplementation(() => {});
  await promise;
  expect(print).toHaveBeenCalledOnce();
  expect(html2canvas).not.toHaveBeenCalled();
  expect(document.querySelector("[data-pdf-export]")).toBeNull();
});


it("cancels immediately while an image is still loading", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const assertion = expect(buildPdfDocument("Notes", '<p>Notes</p><img src="https://example.invalid/pending.png" />', undefined, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await assertion;
  expect(document.querySelector("[data-pdf-export]")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
