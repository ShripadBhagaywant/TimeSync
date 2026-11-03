// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
import { useEditorPersistence } from "@/features/workspace/hooks/useEditorPersistence";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
import { createPlaylistNoteDocument } from "@/features/workspace/utils/playlistNoteDocument";

const db = vi.hoisted(() => ({ EDITOR_DRAFT_TTL_MS: 7 * 24 * 60 * 60 * 1000, getDraft: vi.fn(), saveDraft: vi.fn(), deleteDraft: vi.fn(), saveVideoWorkspace: vi.fn(), savePlaylistNoteDocument: vi.fn(), deletePlaylistNoteDocument: vi.fn(), writeDraftRecoverySnapshot: vi.fn(), writePlaylistDocumentRecoverySnapshot: vi.fn() }));
vi.mock("@/lib/indexDB", () => db);
vi.mock("@/lib/toast", () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const video = { videoId: "one", title: "Lesson", content: "Server transcript", cleanedTranscript: "Server transcript", chapters: [], transcriptSegments: [], isEditableChapters: true } as unknown as TranscriptResponse;
let editor: Editor;
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  db.getDraft.mockResolvedValue(undefined);
  db.saveDraft.mockResolvedValue(undefined);
  db.savePlaylistNoteDocument.mockResolvedValue(undefined);
  db.deletePlaylistNoteDocument.mockResolvedValue(undefined);
  db.saveVideoWorkspace.mockResolvedValue(undefined);
  useWorkspaceStore.getState().resetWorkspace();
  useWorkspaceStore.getState().setAutoSaveEnabled(true);
  useWorkspaceStore.getState().setActiveVideo(video);
  editor = new Editor({ extensions: [StarterKit], content: "<p>Loading</p>" });
});
afterEach(() => { cleanup(); editor.destroy(); vi.useRealTimers(); });
const flush = async () => { await act(async () => { }); };

describe("editor persistence lifecycle", () => {
  it("uses workspace content when local draft storage fails", async () => {
    db.getDraft.mockRejectedValue(new Error("Unavailable"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderHook(() => useEditorPersistence(editor));
    await flush();
    expect(editor.getText()).toBe("Server transcript");
    warning.mockRestore();
  });
  it("does not save an empty metadata draft but saves manual notes", async () => {
    useWorkspaceStore.getState().setActiveVideo({ ...video, content: "", cleanedTranscript: "", noteSource: "METADATA", transcriptAvailability: "UNAVAILABLE" });
    renderHook(() => useEditorPersistence(editor));
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(db.saveDraft).not.toHaveBeenCalled();
    act(() => { editor.commands.insertContent("Manual learning notes"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(db.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ content: "<p>Manual learning notes</p>" }), expect.any(Function));
  });

  it("hydrates a saved draft before server content and only then enables saving", async () => {
    db.getDraft.mockResolvedValue({ videoId: "one", content: "<p>My edits</p>", updatedAt: Date.now() });
    renderHook(() => useEditorPersistence(editor));
    expect(db.saveDraft).not.toHaveBeenCalled();
    await flush();
    expect(editor.getText()).toBe("My edits");
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(db.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ videoId: "one", content: "<p>My edits</p>" }), expect.any(Function));
  });
  it("ignores hydration completing after a video switch", async () => {
    let resolve!: (value: unknown) => void;
    db.getDraft.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    renderHook(() => useEditorPersistence(editor));
    await act(async () => { useWorkspaceStore.getState().setActiveVideo({ ...video, videoId: "two", content: "Second", cleanedTranscript: "Second" }); });
    await act(async () => { resolve({ content: "<p>Stale first draft</p>" }); });
    expect(editor.getText()).toBe("Second");
  });
  it("persists a cleared single-video tombstone and saves new edits after the next change", async () => {
    const { result } = renderHook(() => useEditorPersistence(editor));
    await flush();
    await act(async () => { await result.current.clearDraft(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(db.saveDraft).toHaveBeenNthCalledWith(1, expect.objectContaining({ videoId: "one", content: "" }));
    act(() => { editor.commands.insertContent("New writing"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(db.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ content: "<p>New writing</p>" }), expect.any(Function));
  });
  it("keeps the playlist master document when the active video changes", async () => {
    const master = { ...createPlaylistNoteDocument("course", "Course"), content: "<p>Master edits</p>" };
    useWorkspaceStore.getState().setPlaylistNoteDocument(master);
    renderHook(() => useEditorPersistence(editor));
    await flush();
    await act(async () => { useWorkspaceStore.getState().setActiveVideo({ ...video, videoId: "two" }); });
    expect(editor.getText()).toBe("Master edits");
    expect(db.getDraft).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(db.savePlaylistNoteDocument).toHaveBeenCalledWith(master);
    expect(db.saveDraft).not.toHaveBeenCalled();
  });
  it("cancels pending autosave on unmount", async () => {
    const { unmount } = renderHook(() => useEditorPersistence(editor));
    await flush();
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(db.saveDraft).not.toHaveBeenCalled();
  });
  it("writes the latest edit synchronously when the browser page is closing", async () => {
    renderHook(() => useEditorPersistence(editor));
    await flush();
    act(() => { editor.commands.insertContent("Last moment edit"); });
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(db.writeDraftRecoverySnapshot).toHaveBeenCalledWith(expect.objectContaining({
      videoId: "one",
      content: "<p>Server transcriptLast moment edit</p>",
    }));
  });
  it("does not create exit recovery snapshots when auto-save is disabled", async () => {
    useWorkspaceStore.getState().setAutoSaveEnabled(false);
    renderHook(() => useEditorPersistence(editor));
    await flush();
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(db.writeDraftRecoverySnapshot).not.toHaveBeenCalled();
  });
});
