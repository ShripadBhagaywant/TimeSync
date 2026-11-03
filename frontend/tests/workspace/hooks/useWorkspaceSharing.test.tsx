// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWorkspaceSharing } from "@/features/workspace/hooks/useWorkspaceSharing";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";

const mocks = vi.hoisted(() => ({ createSnapshot: vi.fn(), writeText: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/features/notes/api/notesApi", () => ({ notesApi: mocks }));
vi.mock("@/lib/toast", () => ({ notify: mocks }));
const video: TranscriptResponse = {
  videoId: "lesson", title: "Lesson", channelName: "", thumbnailUrl: "", content: "Evidence",
  transcriptSegments: [], duration: "", cleanedTranscript: "Evidence", cleaningStage: "RAW_TRANSCRIPT",
  chapters: [], isEditableChapters: true, cachedResponse: false,
};
const mount = (content = "<p>Edited notes</p>") => renderHook(() => useWorkspaceSharing({
  activeVideo: video, currentTitle: "Renamed notes", content, editorRef: { current: null },
}));
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.writeText } });
  mocks.createSnapshot.mockResolvedValue({ hashId: "snapshot", shareUrl: "/notes/snapshot" });
});
afterEach(cleanup);

it("shares edited notes and the current title", async () => {
  const { result } = mount();
  await act(() => result.current.handleSnapshot());
  expect(mocks.createSnapshot).toHaveBeenCalledWith({ videoId: "lesson", videoTitle: "Renamed notes", noteContent: "<p>Edited notes</p>", cleaningStage: "RAW_TRANSCRIPT" });
  expect(mocks.writeText).toHaveBeenCalledWith(result.current.shareUrl);
});
it("prevents duplicate requests even before React rerenders", async () => {
  let complete!: (value: { hashId: string }) => void;
  mocks.createSnapshot.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  const { result } = mount();
  await act(async () => { void result.current.handleSnapshot(); void result.current.handleSnapshot(); });
  expect(mocks.createSnapshot).toHaveBeenCalledTimes(1);
  expect(result.current.isSharing).toBe(true);
  await act(async () => complete({ hashId: "one" }));
  expect(result.current.isSharing).toBe(false);
});
it("rejects empty rich text without sharing", async () => {
  const { result } = mount("<p>&nbsp;<br></p>");
  await act(() => result.current.handleSnapshot());
  expect(mocks.createSnapshot).not.toHaveBeenCalled();
});
it("keeps the created link available when copying is denied", async () => {
  mocks.writeText.mockRejectedValue(new Error("denied"));
  const { result } = mount();
  await act(() => result.current.handleSnapshot());
  expect(result.current.shareUrl).toContain("/notes/snapshot");
  expect(mocks.success).toHaveBeenCalledWith("Shareable note created", "Copy the link from the share dialog.");
});
it("releases the request guard after failure so retry works", async () => {
  mocks.createSnapshot.mockRejectedValueOnce(new Error("Try again"));
  const { result } = mount();
  await act(() => result.current.handleSnapshot());
  expect(result.current.isSharing).toBe(false);
  await act(() => result.current.handleSnapshot());
  expect(result.current.shareUrl).toContain("/notes/snapshot");
});
