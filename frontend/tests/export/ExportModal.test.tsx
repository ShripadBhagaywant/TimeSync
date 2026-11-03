// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportModal } from "@/features/workspace/components/export/ExportModal";
const exportDocument = vi.hoisted(() => vi.fn());
vi.mock("@/features/workspace/utils/exportUtils", () => ({ exportDocument }));
vi.mock("@/lib/toast", () => ({ notify: { info: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const open = () => render(<ExportModal isOpen onClose={vi.fn()} documentTitle="Lesson" editorHtmlContent="<p>Notes</p>" />);
describe("PDF export controls", () => {
  it("downloads PDF directly without output or alignment settings", async () => {
    exportDocument.mockResolvedValue(undefined);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(exportDocument).toHaveBeenCalledWith("Lesson", "<p>Notes</p>", "pdf", undefined, expect.objectContaining({ delivery: "download", alignment: "justify" })));
  });
  it("does not show PDF output or paragraph alignment selectors", () => {
    open();
    expect(screen.queryByLabelText("PDF output")).toBeNull();
    expect(screen.queryByLabelText("Paragraph alignment")).toBeNull();
  });
  it("cancels active export and enables another attempt", async () => {
    exportDocument.mockImplementation((_title, _html, _format, _id, options) => new Promise((_resolve, reject) => {
      options.onProgress("Arranging pages…");
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    }));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await screen.findByText("Arranging pages…");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Download PDF" }) as HTMLButtonElement).disabled).toBe(false));
  });
});
