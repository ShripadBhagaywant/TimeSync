// @vitest-environment jsdom
import { StrictMode, type PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptResponse, PlaylistTranscriptResponse } from "@/features/extraction/types/extraction.types";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
import { useWorkspaceData } from "@/features/workspace/hooks/useWorkspaceData";
import { chapterAuthority } from "@/features/workspace/utils/chapterAuthority";

const mocks = vi.hoisted(() => ({
  params: {} as { videoId?: string; playlistId?: string; playlistVideoId?: string }, state: null as unknown,
  getTranscriptSource: vi.fn(), getDraft: vi.fn(), getPlaylistNoteDocument: vi.fn(),
  saveVideoWorkspace: vi.fn(), savePlaylistWorkspace: vi.fn(), getVideo: vi.fn(), getPlaylist: vi.fn(),
}));
vi.mock("react-router-dom", () => ({ useParams: () => mocks.params, useLocation: () => ({ state: mocks.state }) }));
vi.mock("@/lib/indexDB", () => mocks);
vi.mock("@/features/extraction/api/extractionApi", () => ({ extractionApi: mocks }));
const video = { videoId: "one", title: "Lesson", content: "Transcript evidence", cleanedTranscript: "Transcript evidence",
  chapters: [], transcriptSegments: [], isEditableChapters: true, noteSource: "CAPTIONS", transcriptAvailability: "AVAILABLE" } as unknown as TranscriptResponse;
const imported = { ...video, content: "My imported transcript", noteSource: "USER_PROVIDED", transcriptAvailability: "USER_PROVIDED" } as TranscriptResponse;
const metadata = { ...video, content: "", cleanedTranscript: "", noteSource: "METADATA", transcriptAvailability: "UNAVAILABLE" } as TranscriptResponse;
const playlist = { playlistId: "course", playlistTitle: "Course", videoNotes: [video, { ...video, videoId: "two" }] } as PlaylistTranscriptResponse;
const clients: QueryClient[] = [];
const mount = (strict = false) => {
  const client = new QueryClient(); clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{strict ? <StrictMode>{children}</StrictMode> : children}</QueryClientProvider>;
  return renderHook(useWorkspaceData, { wrapper });
};
beforeEach(() => {
  chapterAuthority.clear();
  vi.resetAllMocks(); localStorage.clear(); useWorkspaceStore.getState().resetWorkspace();
  useWorkspaceStore.setState({ videoPreferences: {} });
  mocks.params = { videoId: "one" }; mocks.state = null;
  mocks.getVideo.mockResolvedValue(video); mocks.getPlaylist.mockResolvedValue(playlist);
  mocks.saveVideoWorkspace.mockResolvedValue(undefined); mocks.savePlaylistWorkspace.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });
const ready = async () => waitFor(() => expect(useWorkspaceStore.getState().activeVideo).not.toBeNull());

describe("workspace hydration before extraction", () => {
  it("preserves verified local evidence over a later metadata-only route response", async () => {
    const verified = { ...video, contentEligibility: "EDUCATIONAL", verificationLevel: "SEMANTIC_VERIFIED" };
    mocks.state = { transcriptData: metadata };
    mocks.getTranscriptSource.mockResolvedValue({ response: verified });
    mount(); await ready();
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject(verified);
  });
  it("chooses a fresh verified response over legacy storage when hydration finishes later", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getTranscriptSource.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const hook = mount();
    await waitFor(() => expect(resolve).toBeTypeOf("function"));
    const verified = { ...video, content: "Fresh verified text", contentEligibility: "INFORMATIONAL" as const, verificationLevel: "SEMANTIC_VERIFIED" as const };
    act(() => useWorkspaceStore.getState().setActiveVideo(verified));
    await act(async () => resolve({ response: video }));
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject(verified);
  });
  const oldChapters = [{ title: "Old stored chapter", startTimestampSeconds: 0, formattedTimestamp: "00:00" }];
  it("keeps fresh chapter failure authoritative over an old snapshot and imported evidence", async () => {
    const fresh = { ...video, chapterAvailability: "TEMPORARILY_UNAVAILABLE" as const };
    mocks.state = { transcriptData: fresh };
    mocks.getTranscriptSource.mockResolvedValue({ response: { ...imported, chapters: oldChapters, chapterAvailability: "AVAILABLE", isEditableChapters: false } });
    useWorkspaceStore.getState().recordChapterResponse(fresh);
    mount(); await ready();
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ content: imported.content, chapters: [], chapterAvailability: "TEMPORARILY_UNAVAILABLE", isEditableChapters: true });
    expect(mocks.saveVideoWorkspace).toHaveBeenCalledWith(expect.objectContaining({ chapters: [], chapterAvailability: "TEMPORARILY_UNAVAILABLE" }));
    expect(mocks.getVideo).not.toHaveBeenCalled();
  });

  it("does not let a delayed local read overwrite fresh chapter state", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getTranscriptSource.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const hook = mount();
    await waitFor(() => expect(resolve).toBeTypeOf("function"));
    act(() => useWorkspaceStore.getState().recordChapterResponse({ ...video, chapterAvailability: "TEMPORARILY_UNAVAILABLE" }));
    await act(async () => resolve({ response: { ...video, chapters: oldChapters, chapterAvailability: "AVAILABLE", isEditableChapters: false } }));
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ chapters: [], chapterAvailability: "TEMPORARILY_UNAVAILABLE", isEditableChapters: true });
  });

  it("updates an already restored workspace immediately when native chapters become available", async () => {
    mocks.getTranscriptSource.mockResolvedValue({ response: { ...video, chapterAvailability: "TEMPORARILY_UNAVAILABLE" } });
    mount(); await ready();
    act(() => useWorkspaceStore.getState().recordChapterResponse({ ...video, chapters: oldChapters, chapterAvailability: "AVAILABLE", isEditableChapters: false }));
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ chapters: oldChapters, chapterAvailability: "AVAILABLE", isEditableChapters: false });
    // Recovery of saved evidence is also unable to replace fresh chapter fields.
    act(() => useWorkspaceStore.getState().replaceVideoResponse(imported));
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ content: imported.content, chapters: oldChapters, chapterAvailability: "AVAILABLE" });
  });

  it("applies freshness per playlist video while preserving master notes and imports", async () => {
    mocks.params = { playlistId: "course", playlistVideoId: "two" };
    mocks.getPlaylistNoteDocument.mockResolvedValue({ playlistId: "course", title: "Master", content: "<p>Keep edits</p>", sections: [], workspace: { ...playlist, videoNotes: playlist.videoNotes.map((item) => ({ ...item, chapters: oldChapters, chapterAvailability: "AVAILABLE" })) } });
    mocks.getTranscriptSource.mockImplementation(async (id) => id === "two" ? { response: { ...imported, videoId: "two", chapters: oldChapters } } : undefined);
    useWorkspaceStore.getState().recordChapterResponse({ ...video, videoId: "two", chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
    const hook = mount(); await ready();
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ videoId: "two", content: imported.content, chapters: [], chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
    expect(useWorkspaceStore.getState().playlistNoteDocument?.content).toBe("<p>Keep edits</p>");
    mocks.params = { playlistId: "course", playlistVideoId: "one" }; hook.rerender();
    await waitFor(() => expect(useWorkspaceStore.getState().activeVideo?.videoId).toBe("one"));
    expect(useWorkspaceStore.getState().activeVideo?.chapters).toEqual(oldChapters);
    expect(mocks.getPlaylist).not.toHaveBeenCalled();
  });

  it("persists the source response without custom overlays when preferences exist or change", async () => {
    const custom = [{ title: "Saved marker", startTimestampSeconds: 4, formattedTimestamp: "00:04" }];
    useWorkspaceStore.setState({ videoPreferences: { one: { isStarred: false, customChapters: custom } } });
    mocks.getVideo.mockResolvedValue({ ...video, chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
    mount(); await ready();
    act(() => useWorkspaceStore.getState().setEditableChapters([...custom, { title: "New marker", startTimestampSeconds: 6, formattedTimestamp: "00:06" }]));
    expect(useWorkspaceStore.getState().activeVideo?.chapters).toEqual([]);
    for (const [saved] of mocks.saveVideoWorkspace.mock.calls) {
      expect(saved.chapters).toEqual([]);
      expect(saved.chapterAvailability).toBe("TEMPORARILY_UNAVAILABLE");
    }
  });

  it("retains temporary chapter availability after a browser-style refresh", async () => {
    let persisted: TranscriptResponse | undefined;
    mocks.getVideo.mockResolvedValue({ ...video, chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
    mocks.saveVideoWorkspace.mockImplementation(async (value) => { persisted = value; });
    mocks.getTranscriptSource.mockImplementation(async () => persisted ? { response: persisted } : undefined);
    const first = mount(); await ready(); first.unmount();
    chapterAuthority.clear(); // A real browser reload discards session provenance.
    useWorkspaceStore.getState().resetWorkspace(); mocks.getVideo.mockClear();
    const restored = mount(); await ready();
    expect(restored.result.current.videoData?.chapterAvailability).toBe("TEMPORARILY_UNAVAILABLE");
    expect(restored.result.current.videoData?.isEditableChapters).toBe(true);
    expect(mocks.getVideo).not.toHaveBeenCalled();
  });

  it("extracts once for a fresh workspace and persists its response", async () => {
    const hook = mount(); await ready(); hook.rerender();
    expect(mocks.getVideo).toHaveBeenCalledTimes(1);
    expect(mocks.saveVideoWorkspace).toHaveBeenCalledWith(video);
  });
  it("does not extract while hydration is pending, then extracts once when empty", async () => {
    let resolve!: (value: undefined) => void;
    mocks.getTranscriptSource.mockReturnValue(new Promise((done) => { resolve = done; }));
    const hook = mount();
    expect(hook.result.current.hydrationStatus).toBe("hydrating");
    expect(mocks.getVideo).not.toHaveBeenCalled();
    await act(async () => resolve(undefined)); await ready();
    expect(mocks.getVideo).toHaveBeenCalledTimes(1);
  });
  it.each([video, imported, metadata])("restores saved $noteSource without extraction", async (saved) => {
    mocks.getTranscriptSource.mockResolvedValue({ response: saved });
    const hook = mount(); await ready();
    expect(hook.result.current.hydrationStatus).toBe("restored");
    expect(useWorkspaceStore.getState().activeVideo?.noteSource).toBe(saved.noteSource);
    expect(mocks.getVideo).not.toHaveBeenCalled();
  });
  it("restores after a browser-style remount with an empty store and fresh query client", async () => {
    let persisted: TranscriptResponse | undefined;
    mocks.saveVideoWorkspace.mockImplementation(async (value) => { persisted = value; });
    mocks.getTranscriptSource.mockImplementation(async () => persisted ? { response: persisted } : undefined);
    const first = mount(); await ready(); first.unmount();
    useWorkspaceStore.getState().resetWorkspace(); mocks.getVideo.mockClear();
    mount(); await ready(); expect(mocks.getVideo).not.toHaveBeenCalled();
  });
  it("prioritizes imported evidence over stale router metadata", async () => {
    mocks.state = { transcriptData: metadata };
    mocks.getTranscriptSource.mockResolvedValue({ response: imported });
    mount(); await ready();
    expect(useWorkspaceStore.getState().activeVideo?.content).toBe(imported.content);
    expect(mocks.getVideo).not.toHaveBeenCalled();
  });
  it("restores saved caption evidence before stale router metadata", async () => {
    mocks.state = { transcriptData: metadata };
    mocks.getTranscriptSource.mockResolvedValue({ response: video });
    mount(); await ready();
    expect(useWorkspaceStore.getState().activeVideo?.content).toBe(video.content);
    expect(mocks.getVideo).not.toHaveBeenCalled();
  });
  it("ignores a previous route's hydration result after switching videos", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getTranscriptSource.mockImplementation((id) => id === "one" ? new Promise((done) => { resolve = done; }) : Promise.resolve({ response: { ...video, videoId: "two" } }));
    const hook = mount();
    mocks.params = { videoId: "two" }; hook.rerender(); await ready();
    await act(async () => resolve({ response: video }));
    expect(useWorkspaceStore.getState().activeVideo?.videoId).toBe("two");
    expect(mocks.getVideo).not.toHaveBeenCalled();
  });
  it("accepts legacy source entries missing optional fields", async () => {
    mocks.getTranscriptSource.mockResolvedValue({ response: { videoId: "one", title: "Old notes", content: "Evidence" } });
    mount(); await ready();
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ chapters: [], transcriptSegments: [], content: "Evidence" });
    expect(mocks.getVideo).not.toHaveBeenCalled();
  });
  it("preserves a legacy editor draft without treating notes as transcript evidence", async () => {
    const draft = { videoId: "one", videoTitle: "My notes", content: "<p>Edited notes</p>" };
    mocks.getDraft.mockResolvedValue(draft);
    mount(); await ready();
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ title: "My notes", noteSource: "METADATA", content: "", aiRefinementEnabled: false });
    expect(draft.content).toBe("<p>Edited notes</p>");
    expect(mocks.getVideo).not.toHaveBeenCalled();
  });
  it("falls back for corrupt or mismatched saved data", async () => {
    mocks.getTranscriptSource.mockResolvedValue({ response: { videoId: "other", title: "Wrong", content: "Evidence" } });
    mount(); await ready(); expect(mocks.getVideo).toHaveBeenCalledTimes(1);
  });
  it("falls back after IndexedDB fails instead of staying stuck", async () => {
    mocks.getTranscriptSource.mockRejectedValue(new Error("unavailable"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(); await ready(); expect(mocks.getVideo).toHaveBeenCalledTimes(1); warning.mockRestore();
  });
  it("starts extraction at most once under StrictMode", async () => {
    mount(true); await ready(); expect(mocks.getVideo).toHaveBeenCalledTimes(1);
  });
  it("restores playlist membership, selection, imports and master content", async () => {
    mocks.params = { playlistId: "course" };
    mocks.getPlaylistNoteDocument.mockResolvedValue({ playlistId: "course", title: "Master", content: "<p>Master edits</p>", sections: [], workspace: playlist, activeVideoId: "two" });
    mocks.getTranscriptSource.mockImplementation(async (id) => id === "two" ? { response: { ...imported, videoId: "two" } } : undefined);
    const hook = mount(); await ready();
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ videoId: "two", noteSource: "USER_PROVIDED" });
    expect(useWorkspaceStore.getState().playlistNoteDocument?.content).toBe("<p>Master edits</p>");
    mocks.params = { playlistId: "course", playlistVideoId: "one" }; hook.rerender();
    await waitFor(() => expect(useWorkspaceStore.getState().activeVideo?.videoId).toBe("one"));
    expect(mocks.getPlaylist).not.toHaveBeenCalled();
  });
  it("restores compatible old playlist master notes", async () => {
    mocks.params = { playlistId: "course", playlistVideoId: "one" };
    mocks.getPlaylistNoteDocument.mockResolvedValue({ playlistId: "course", title: "Master", content: "<p>Master edits</p>", sections: [{ videoId: "one", videoTitle: "Lesson" }] });
    mount(); await ready(); expect(mocks.getPlaylist).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().playlistNoteDocument?.content).toBe("<p>Master edits</p>");
  });
  it("does not invent completion for an orphaned transient AI status", async () => {
    mocks.getTranscriptSource.mockResolvedValue({ response: { ...video, aiStatus: "PROCESSING", aiJobId: null } });
    mount(); await ready(); expect(useWorkspaceStore.getState().activeVideo?.aiStatus).toBe("NOT_REQUESTED");
  });
  it("does not automatically retry failed extraction on rerender", async () => {
    mocks.getVideo.mockRejectedValue(new Error("Temporary failure"));
    const hook = mount(); await waitFor(() => expect(hook.result.current.error).not.toBeNull()); hook.rerender();
    expect(mocks.getVideo).toHaveBeenCalledTimes(1);
    mocks.getVideo.mockResolvedValue(video);
    await act(async () => { await hook.result.current.refetch(); }); await ready();
    expect(mocks.getVideo).toHaveBeenCalledTimes(2);
  });
});


it("renders restored evidence without waiting for a storage write", async () => {
  mocks.getTranscriptSource.mockResolvedValue({ response: imported });
  mocks.saveVideoWorkspace.mockImplementation(() => new Promise(() => {}));
  const hook = mount();
  await ready();
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(hook.result.current.videoData?.content).toBe(imported.content);
  expect(mocks.getVideo).not.toHaveBeenCalled();
  expect(mocks.saveVideoWorkspace).toHaveBeenCalledTimes(1);
});
