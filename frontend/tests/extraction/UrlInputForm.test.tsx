// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UrlInputForm } from "@/features/extraction/components/UrlInputForm";
import { ApiError } from "@/lib/apiError";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
const mocks = vi.hoisted(() => ({ navigate: vi.fn(), mutate: vi.fn(), success: vi.fn(), error: vi.fn(), errorToast: vi.fn(), warningToast: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/features/extraction/hooks/useVideoExtraction", () => ({ useVideoExtraction: () => ({ mutate: mocks.mutate, isPending: false }), usePlaylistExtraction: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("@/lib/toast", () => ({ notify: { success: mocks.success, error: mocks.error, errorToast: mocks.errorToast, warning: vi.fn(), warningToast: mocks.warningToast } }));
const metadata = { videoId: "abcdefghijk", title: "Lesson", noteSource: "METADATA", transcriptAvailability: "UNAVAILABLE" } as TranscriptResponse;
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
const submit = () => {
  render(<UrlInputForm />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "https://youtu.be/abcdefghijk" } });
  fireEvent.click(screen.getByRole("button", { name: "Open Workspace" }));
};
describe("initial extraction outcomes", () => {
  it("navigates metadata success to the normal workspace instead of showing an error", async () => {
    mocks.mutate.mockImplementation((_request, options) => options.onSuccess(metadata));
    submit();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/workspace/video/abcdefghijk", { state: { transcriptData: metadata } }));
    expect(mocks.success).toHaveBeenCalledWith("Video workspace ready", expect.stringContaining("import a transcript"));
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it("labels non-educational rejection as an eligibility decision", async () => {
    mocks.mutate.mockImplementation((_request, options) => options.onError(new ApiError("Rejected", { code: "NON_EDUCATIONAL_CONTENT", status: 422 })));
    submit();
    await waitFor(() => expect(mocks.errorToast).toHaveBeenCalledWith(
      "Video not eligible",
      "TimeSync Notes supports educational or informational videos. This video could not be verified for that purpose.",
    ));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("keeps a rate-limit response as an error with its delay and no navigation", async () => {
    mocks.mutate.mockImplementation((_request, options) => options.onError(new ApiError("Limited", { code: "YOUTUBE_RATE_LIMITED", status: 429, retryAfterSeconds: 47 })));
    submit();
    await waitFor(() => expect(mocks.errorToast).toHaveBeenCalledWith("Extraction Failed", expect.stringContaining("47 seconds")));
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.mutate).toHaveBeenCalledOnce();
  });
  it("shows URL validation feedback as a toast instead of opening a dialog", async () => {
    render(<UrlInputForm />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Open Workspace" }));
    await waitFor(() => expect(mocks.warningToast).toHaveBeenCalledWith("Check URL Input", expect.stringContaining("Invalid YouTube URL")));
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
