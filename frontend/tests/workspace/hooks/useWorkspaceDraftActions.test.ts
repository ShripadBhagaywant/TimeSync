// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptResponse, PlaylistTranscriptResponse } from "@/features/extraction/types/extraction.types";
import { useWorkspaceDraftActions } from "@/features/workspace/hooks/useWorkspaceDraftActions";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
import { createPlaylistNoteDocument } from "@/features/workspace/utils/playlistNoteDocument";
const db = vi.hoisted(() => ({ applyWorkspaceDraft: vi.fn(), deleteDraft: vi.fn(), getTranscriptSource: vi.fn(), saveVideoWorkspace: vi.fn(), saveTranscriptSource: vi.fn(), savePlaylistNoteDocument: vi.fn() }));
vi.mock("@/lib/indexDB", () => db);
vi.mock("@/lib/toast", () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const video = { videoId: "one", title: "Lesson", content: "Original", chapters: [], transcriptSegments: [] } as unknown as TranscriptResponse;
const draft = { ...video, content: "AI explanation", cleanedTranscript: "AI explanation" };
beforeEach(() => {
  vi.resetAllMocks();
  db.applyWorkspaceDraft.mockResolvedValue(true);
  db.saveVideoWorkspace.mockResolvedValue(undefined);
  db.savePlaylistNoteDocument.mockResolvedValue(undefined);
  db.saveTranscriptSource.mockResolvedValue(undefined);
  useWorkspaceStore.getState().resetWorkspace();
  useWorkspaceStore.getState().setActiveVideo(video);
  useWorkspaceStore.getState().setPendingAiDraft("one", draft);
});
afterEach(cleanup);
describe("explicit workspace draft actions", () => {
  it("applies a single-video draft only after the action is invoked", async () => {
    const revision = vi.fn();
    const { result } = renderHook(() => useWorkspaceDraftActions(vi.fn(), revision));
    expect(useWorkspaceStore.getState().activeVideo?.content).toBe("Original");
    expect(db.deleteDraft).not.toHaveBeenCalled();
    await act(async () => { await result.current.applyAiDraft(); });
    expect(db.applyWorkspaceDraft).toHaveBeenCalledWith(draft, expect.any(Function));
    expect(useWorkspaceStore.getState().activeVideo?.content).toBe("AI explanation");
    expect(useWorkspaceStore.getState().pendingAiDrafts.one).toBeUndefined();
    expect(revision).toHaveBeenCalledOnce();
  });
  it("adds to the playlist master without deleting the single-video draft", async () => {
    useWorkspaceStore.getState().setPlaylistData({ playlistId: "course", playlistTitle: "Course", videoNotes: [video] } as PlaylistTranscriptResponse);
    useWorkspaceStore.getState().setPlaylistNoteDocument({ ...createPlaylistNoteDocument("course", "Course"), content: "<p>My introduction</p>" });
    useWorkspaceStore.getState().setPendingAiDraft("one", draft);
    const { result } = renderHook(() => useWorkspaceDraftActions(vi.fn(), vi.fn()));
    await act(async () => { await result.current.applyAiDraft(); });
    const master = useWorkspaceStore.getState().playlistNoteDocument;
    expect(master?.content).toContain("My introduction");
    expect(master?.content).toContain("AI explanation");
    expect(master?.sections).toHaveLength(1);
    expect(db.deleteDraft).not.toHaveBeenCalled();
  });
  it("restores a source without replacing or remounting the playlist master", async () => {
    useWorkspaceStore.getState().setPlaylistData({ playlistId: "course", videoNotes: [video] } as PlaylistTranscriptResponse);
    const master = { ...createPlaylistNoteDocument("course", "Course"), content: "<p>Master edits</p>" };
    useWorkspaceStore.getState().setPlaylistNoteDocument(master);
    db.getTranscriptSource.mockResolvedValue({ response: video });
    const revision = vi.fn();
    const { result } = renderHook(() => useWorkspaceDraftActions(vi.fn(), revision));
    await act(async () => { await result.current.restoreOriginalDraft(); });
    expect(useWorkspaceStore.getState().playlistNoteDocument).toEqual(master);
    expect(revision).not.toHaveBeenCalled();
  });
});

it("durably discards a ready draft without changing editor content", async () => {
  const { result } = renderHook(() => useWorkspaceDraftActions(vi.fn(), vi.fn()));
  await act(async () => { await result.current.discardAiDraft("one"); });
  expect(db.saveVideoWorkspace).toHaveBeenCalledWith(expect.objectContaining({ videoId: "one" }), null);
  expect(useWorkspaceStore.getState().pendingAiDrafts.one).toBeUndefined();
  expect(useWorkspaceStore.getState().activeVideo?.content).toBe("Original");
});
it("keeps a pending draft available if applying it cannot be saved", async () => {
  db.applyWorkspaceDraft.mockRejectedValue(new Error("Storage failed"));
  const { result } = renderHook(() => useWorkspaceDraftActions(vi.fn(), vi.fn()));
  await act(async () => { await result.current.applyAiDraft(); });
  expect(useWorkspaceStore.getState().pendingAiDrafts.one).toEqual(draft);
  expect(useWorkspaceStore.getState().activeVideo?.content).toBe("Original");
  expect(db.deleteDraft).not.toHaveBeenCalled();
});
it("does not switch videos when applying a draft finishes late", async () => {
  let resolve!: () => void;
  db.applyWorkspaceDraft.mockImplementation(() => new Promise<boolean>(r => { resolve = () => r(false); }));
  const { result } = renderHook(() => useWorkspaceDraftActions(vi.fn(), vi.fn()));
  let applying!: Promise<void>;
  act(() => { applying = result.current.applyAiDraft(); });
  act(() => useWorkspaceStore.getState().setActiveVideo({ ...video, videoId: "two" }));
  await act(async () => { resolve(); await applying; });
  expect(useWorkspaceStore.getState().activeVideo?.videoId).toBe("two");
  expect(db.deleteDraft).not.toHaveBeenCalled();
});

it("does not apply an obsolete result over a new import for the same video", async () => {
  let resolve!: () => void;
  db.applyWorkspaceDraft.mockImplementation(() => new Promise<boolean>(r => { resolve = () => r(false); }));
  const revision = vi.fn();
  const { result } = renderHook(() => useWorkspaceDraftActions(vi.fn(), revision));
  let applying!: Promise<void>;
  act(() => { applying = result.current.applyAiDraft(); });
  act(() => {
    useWorkspaceStore.getState().discardPendingAiDraft("one");
    useWorkspaceStore.getState().replaceVideoResponse({ ...video, content: "New import" });
  });
  await act(async () => { resolve(); await applying; });
  expect(useWorkspaceStore.getState().activeVideo?.content).toBe("New import");
  expect(db.deleteDraft).not.toHaveBeenCalled();
  expect(revision).not.toHaveBeenCalled();
});
