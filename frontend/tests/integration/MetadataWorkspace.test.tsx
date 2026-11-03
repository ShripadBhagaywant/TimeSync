// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspacePage } from "@/features/workspace/pages/WorkspacePage";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
import { ApiError } from "@/lib/apiError";

const api = vi.hoisted(() => ({ importTranscript: vi.fn(), refineTranscript: vi.fn(), getAiNoteJob: vi.fn() }));
const db = vi.hoisted(() => ({ getTranscriptSource: vi.fn(), saveTranscriptSource: vi.fn(), saveVideoWorkspace: vi.fn(), getPlaylistNoteDocument: vi.fn(), deleteDraft: vi.fn() }));
const workspace = vi.hoisted(() => ({ error: null as Error | null }));
vi.mock("@/features/extraction/api/extractionApi", () => ({ extractionApi: api }));
vi.mock("@/lib/indexDB", () => db);
vi.mock("@/features/workspace/hooks/useWorkspaceData", () => ({ useWorkspaceData: () => ({ isLoading: false, error: workspace.error, refetch: vi.fn() }) }));
vi.mock("@/features/workspace/components/player/YouTubeSyncPlayer", () => ({ YouTubeSyncPlayer: () => <div>Video player</div> }));
vi.mock("@/features/workspace/components/editor/NotesEditor", () => ({ NotesEditor: () => <textarea aria-label="Manual notes" /> }));
vi.mock("@/lib/toast", () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
const metadata: TranscriptResponse = {
  contentEligibility: "UNKNOWN", verificationLevel: "UNVERIFIED", contentReasonCode: "TRANSCRIPT_UNAVAILABLE",
  videoId: "abcdefghijk", title: "Programming lesson", channelName: "Teacher", thumbnailUrl: "", duration: "10:00",
  content: "", cleanedTranscript: "", transcriptSegments: [], noteSource: "METADATA", transcriptAvailability: "UNAVAILABLE",
  chapters: [], isEditableChapters: true, cachedResponse: false, cleaningStage: "METADATA_FALLBACK", aiStatus: "NOT_APPLICABLE", aiRefinementEnabled: false,
};
const imported: TranscriptResponse = {
  ...metadata, content: "Imported evidence", cleanedTranscript: "Imported evidence", noteSource: "USER_PROVIDED",
  transcriptAvailability: "USER_PROVIDED", aiStatus: "NOT_REQUESTED", cleaningStage: "REGEX_SANITIZED",
  contentEligibility: "UNKNOWN", verificationLevel: "UNVERIFIED", contentReasonCode: "METADATA_INCONCLUSIVE",
  transcriptSegments: [{ startSeconds: 0, durationSeconds: 10, text: "Imported evidence" }],
};
beforeEach(() => {
  workspace.error = null;
  vi.resetAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  db.getTranscriptSource.mockResolvedValue(undefined);
  db.getPlaylistNoteDocument.mockResolvedValue(undefined);
  db.saveTranscriptSource.mockResolvedValue(undefined);
  db.saveVideoWorkspace.mockResolvedValue(undefined);
  api.importTranscript.mockResolvedValue(imported);
  localStorage.clear();
  useWorkspaceStore.getState().resetWorkspace();
  useWorkspaceStore.setState({ videoPreferences: {} });
  useWorkspaceStore.getState().setActiveVideo(metadata);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("metadata workspace and import transition", () => {
  it.each(["ENTERTAINMENT", "UNKNOWN"] as const)("blocks a final rejected %s backend response", (contentEligibility) => {
    useWorkspaceStore.getState().setActiveVideo({ ...imported, contentEligibility, verificationLevel: "SEMANTIC_VERIFIED" });
    render(<MemoryRouter><WorkspacePage /></MemoryRouter>);
    expect(screen.getByText("Workspace unavailable")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Manual notes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create structured draft" })).toBeNull();
  });
  it.each(["EDUCATIONAL", "INFORMATIONAL"] as const)("renders verified %s without classifying the title", (contentEligibility) => {
    useWorkspaceStore.getState().setActiveVideo({ ...imported, contentEligibility, verificationLevel: "SEMANTIC_VERIFIED", title: "Official Movie Trailer" });
    render(<MemoryRouter><WorkspacePage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Create structured draft" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Manual notes" })).toBeTruthy();
  });
  it("renders provider outages as temporary errors", () => {
    workspace.error = new ApiError("Provider failed", { code: "AI_PROVIDER_UNAVAILABLE", status: 503 });
    render(<MemoryRouter><WorkspacePage /></MemoryRouter>);
    expect(screen.getByText(/Educational verification is temporarily unavailable/)).toBeTruthy();
    expect(screen.queryByText(/not eligible|entertainment rather/)).toBeNull();
  });
  it("applies eligibility separately as playlist selection changes", () => {
    const approved = { ...imported, videoId: "approved" };
    useWorkspaceStore.getState().setPlaylistData({ playlistId: "course", playlistTitle: "Course", videoNotes: [approved, metadata] } as import("@/features/extraction/types/extraction.types").PlaylistTranscriptResponse);
    useWorkspaceStore.getState().setActiveVideo(approved);
    render(<MemoryRouter><WorkspacePage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Create structured draft" })).toBeTruthy();
    act(() => useWorkspaceStore.getState().setActiveVideo(metadata));
    expect(screen.queryByRole("button", { name: "Create structured draft" })).toBeNull();
    expect(screen.getByRole("button", { name: "Import Transcript" })).toBeTruthy();
    expect(screen.getByText("Transcript unavailable.")).toBeTruthy();
  });
  it("opens a usable workspace, imports evidence, and never starts AI automatically", async () => {
    render(<MemoryRouter><WorkspacePage /></MemoryRouter>);
    expect(screen.getByText("Transcript unavailable")).toBeTruthy();
    expect(screen.getByText("Video player")).toBeTruthy();
    const notes = screen.getByRole("textbox", { name: "Manual notes" }) as HTMLTextAreaElement;
    fireEvent.change(notes, { target: { value: "My manual notes" } });
    expect(screen.queryByRole("button", { name: "Create structured draft" })).toBeNull();
    expect(screen.getByText("Import a transcript, then choose Create structured draft to start AI verification and drafting.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import Transcript" }));
    fireEvent.change(screen.getByPlaceholderText(/Introduction/), { target: { value: "0:00\nImported evidence" } });
    fireEvent.click(screen.getByRole("button", { name: "Parse transcript" }));
    await screen.findByText("Imported evidence");
    await screen.findByRole("button", { name: "Create structured draft" });
    expect(useWorkspaceStore.getState().activeVideo?.noteSource).toBe("USER_PROVIDED");
    expect(useWorkspaceStore.getState().activeVideo?.transcriptAvailability).toBe("USER_PROVIDED");
    expect(db.saveTranscriptSource).toHaveBeenCalledWith(imported);
    expect(api.importTranscript).toHaveBeenCalledWith(expect.objectContaining({ videoId: "abcdefghijk", chapters: [], editableChapters: true }));
    expect(api.refineTranscript).not.toHaveBeenCalled();
    expect(notes.value).toBe("My manual notes");
    expect(api.importTranscript).toHaveBeenCalledTimes(1);
    expect(useWorkspaceStore.getState().activeVideo?.verificationLevel).toBe("UNVERIFIED");
    api.refineTranscript.mockResolvedValue({ ...imported, contentEligibility: "EDUCATIONAL", verificationLevel: "SEMANTIC_VERIFIED" });
    fireEvent.click(screen.getByRole("button", { name: "Create structured draft" }));
    await waitFor(() => expect(api.refineTranscript).toHaveBeenCalledTimes(1));
    expect(api.refineTranscript).toHaveBeenCalledWith(expect.objectContaining({ transcript: "Imported evidence" }));
  });
  it("restores previously imported evidence over a fresh metadata response", async () => {
    db.getTranscriptSource.mockResolvedValue({ response: imported });
    render(<MemoryRouter><WorkspacePage /></MemoryRouter>);
    await screen.findByText("Imported evidence");
    await waitFor(() => expect(useWorkspaceStore.getState().activeVideo?.noteSource).toBe("USER_PROVIDED"));
    expect(api.importTranscript).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create structured draft" })).toBeTruthy();
    expect(api.refineTranscript).not.toHaveBeenCalled();
  });
  it("keeps user chapter preferences when an imported response replaces metadata", async () => {
    const chapter = { title: "My marker", startTimestampSeconds: 12, formattedTimestamp: "00:12" };
    useWorkspaceStore.getState().setEditableChapters([chapter]);
    render(<MemoryRouter><WorkspacePage /></MemoryRouter>);
    await act(async () => { useWorkspaceStore.getState().replaceVideoResponse(imported); });
    expect(useWorkspaceStore.getState().activeVideo?.chapters).toEqual(imported.chapters);
    fireEvent.click(screen.getByRole("button", { name: "Chapters" }));
    expect(screen.getByText("My marker")).toBeTruthy();
    expect(screen.getByText("Showing your saved chapter markers.")).toBeTruthy();
    expect(useWorkspaceStore.getState().videoPreferences.abcdefghijk?.customChapters).toEqual([chapter]);
  });
});
