// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAiStatus } from "@/features/workspace/components/WorkspaceAiStatus";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";

afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("asynchronous note generation cooldown UI", () => {
  it("retains SKIPPED_UNAVAILABLE retry countdown and explicit retry", () => {
    vi.useFakeTimers();
    const retry = vi.fn(async () => {});
    const video = { videoId: "one", title: "Lesson", content: "Imported transcript", noteSource: "USER_PROVIDED", transcriptAvailability: "USER_PROVIDED", aiStatus: "SKIPPED_UNAVAILABLE", retryAfterSeconds: 30, aiMessage: "Provider cooling down", contentEligibility: "EDUCATIONAL", verificationLevel: "SEMANTIC_VERIFIED" } as TranscriptResponse;
    render(<WorkspaceAiStatus activeVideo={video} playlistData={null} visiblePendingAiDraft={null}
      editorDisplayMode="normal" targetLanguage="English" setTargetLanguage={vi.fn()} isStartingAi={false}
      aiRetryKey="one:failure" activeVideoHasPlaylistSection={false} startAiRefinement={retry}
      applyAiDraft={vi.fn(async () => {})} restoreOriginalDraft={vi.fn(async () => {})} discardPendingAiDraft={vi.fn()} />);
    expect(screen.getByText("Provider cooling down")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Retry AI in 30 seconds" }) as HTMLButtonElement).disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry AI" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Restore original draft" })).toBeTruthy();
  });
});

it.each([["QUEUED", "AI draft queued"], ["PROCESSING", "Structuring AI draft"], ["FAILED", "AI draft could not be completed"]] as const)("shows an accurate %s message", (aiStatus, message) => {
  const video = { videoId: "one", title: "Lesson", content: "Transcript", noteSource: "USER_PROVIDED", transcriptAvailability: "USER_PROVIDED", aiStatus } as TranscriptResponse;
  render(<WorkspaceAiStatus activeVideo={video} playlistData={null} visiblePendingAiDraft={null}
    editorDisplayMode="normal" targetLanguage="Hindi" setTargetLanguage={vi.fn()} isStartingAi={false}
    aiRetryKey="one" activeVideoHasPlaylistSection={false} startAiRefinement={vi.fn(async () => {})}
    applyAiDraft={vi.fn(async () => {})} restoreOriginalDraft={vi.fn(async () => {})} discardPendingAiDraft={vi.fn()} />);
  expect(screen.getByText(message)).toBeTruthy();
  expect(screen.queryByText("AI draft was not applied")).toBeNull();
});
