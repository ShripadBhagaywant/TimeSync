// @vitest-environment jsdom
import { ApiError } from "@/lib/apiError";
import { notify } from "@/lib/toast";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
import { useAiRefinement } from "@/features/workspace/hooks/useAiRefinement";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
const storage = vi.hoisted(() => ({ getTranscriptSource: vi.fn(), saveVideoWorkspace: vi.fn() }));
vi.mock("@/lib/indexDB", () => storage);
const api = vi.hoisted(() => ({ getAiNoteJob: vi.fn(), refineTranscript: vi.fn() }));
vi.mock("@/features/extraction/api/extractionApi", () => ({ extractionApi: api }));
vi.mock("@/lib/toast", () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const video = { videoId: "one", title: "Lesson", content: "Original", cleanedTranscript: "Original notes", chapters: [], transcriptSegments: [], aiJobId: "job", aiStatus: "QUEUED", contentEligibility: "EDUCATIONAL", verificationLevel: "SEMANTIC_VERIFIED" } as unknown as TranscriptResponse;
beforeEach(() => { vi.resetAllMocks(); useWorkspaceStore.setState({videoPreferences:{}}); storage.getTranscriptSource.mockResolvedValue(undefined); storage.saveVideoWorkspace.mockResolvedValue(undefined); useWorkspaceStore.getState().resetWorkspace(); useWorkspaceStore.getState().setActiveVideo(video); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("AI draft lifecycle", () => {
  it.each(["English", "Hindi", "Hinglish"])("sends selected %s only when Create draft is clicked", async (language) => {
    useWorkspaceStore.getState().setActiveVideo({ ...video, aiJobId: undefined, aiStatus: "NOT_REQUESTED" });
    api.refineTranscript.mockResolvedValue({ ...video, aiJobId: undefined, aiStatus: "NOT_REQUESTED", targetLanguage: language });
    const { result } = renderHook(() => useAiRefinement(vi.fn()));
    expect(result.current.targetLanguage).toBe("English");
    if (language !== "English") act(() => result.current.setTargetLanguage(language));
    expect(api.refineTranscript).not.toHaveBeenCalled();
    await act(async () => { await result.current.startAiRefinement(); });
    expect(api.refineTranscript).toHaveBeenCalledWith(expect.objectContaining({ targetLanguage: language }));
  });

  it("cannot start or poll AI for metadata, even with stale content/job flags", async () => {
    useWorkspaceStore.getState().setActiveVideo({ ...video, noteSource: "METADATA", transcriptAvailability: "UNAVAILABLE" });
    const openImport = vi.fn();
    const { result } = renderHook(() => useAiRefinement(openImport));
    await act(async () => { await result.current.startAiRefinement(); });
    expect(api.refineTranscript).not.toHaveBeenCalled();
    expect(api.getAiNoteJob).not.toHaveBeenCalled();
    expect(openImport).not.toHaveBeenCalled();
  });

  it("stores a completed draft as pending without replacing the original", async () => {
    const draft = { ...video, content: "AI draft", aiStatus: "COMPLETED" };
    api.getAiNoteJob.mockResolvedValue({ status: "COMPLETED", result: draft });
    renderHook(() => useAiRefinement(vi.fn()));
    await act(async () => { });
    expect(useWorkspaceStore.getState().pendingAiDrafts.one).toEqual(draft);
    expect(useWorkspaceStore.getState().activeVideo?.content).toBe("Original");
  });
  it("ignores a late result after unmount", async () => {
    let resolve!: (value: unknown) => void;
    api.getAiNoteJob.mockImplementation(() => new Promise(r => { resolve = r; }));
    const { unmount } = renderHook(() => useAiRefinement(vi.fn()));
    unmount();
    await act(async () => { resolve({ status: "COMPLETED", result: { ...video, content: "Late draft" } }); });
    expect(useWorkspaceStore.getState().pendingAiDrafts).toEqual({});
  });
  it("starts a new retry identity for repeated failures with the same delay", async () => {
    useWorkspaceStore.getState().setActiveVideo({ ...video, aiStatus: "FAILED", aiJobId: null });
    api.refineTranscript.mockResolvedValue({ ...video, aiStatus: "FAILED", aiJobId: null, retryAfterSeconds: 30 });
    const { result } = renderHook(() => useAiRefinement(vi.fn()));
    await act(async () => { await result.current.startAiRefinement(); });
    const firstKey = result.current.aiRetryKey;
    await act(async () => { await result.current.startAiRefinement(); });
    expect(result.current.aiRetryKey).not.toBe(firstKey);
    expect(useWorkspaceStore.getState().activeVideo?.retryAfterSeconds).toBe(30);
  });
});

describe.each(["AI_PROVIDER_UNAVAILABLE", "AI_PROVIDER_QUOTA_EXCEEDED"])("synchronous classifier failure %s", (code) => {
  it("preserves imported content and workspace state with a retryable status and without automatic resubmission", async () => {
    vi.useFakeTimers();
    const imported: TranscriptResponse = { ...video, noteSource: "USER_PROVIDED", transcriptAvailability: "USER_PROVIDED", aiJobId: null, aiStatus: "NOT_REQUESTED" };
    useWorkspaceStore.getState().setActiveVideo(imported);
    const before = useWorkspaceStore.getState();
    api.refineTranscript.mockRejectedValue(new ApiError("RAW_PROVIDER_PAYLOAD", { code, status: code === "AI_PROVIDER_UNAVAILABLE" ? 503 : 429, retryAfterSeconds: 30 }));
    const { result, rerender } = renderHook(() => useAiRefinement(vi.fn()));
    const retryKey = result.current.aiRetryKey;
    await act(async () => { await result.current.startAiRefinement(); });
    rerender();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(api.refineTranscript).toHaveBeenCalledOnce();
    expect(api.getAiNoteJob).not.toHaveBeenCalled();
    expect(result.current.isStartingAi).toBe(false);
    expect(result.current.aiRetryKey).not.toBe(retryKey);
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ ...before.activeVideo, aiStatus: "FAILED", retryAfterSeconds: 30 });
    expect(useWorkspaceStore.getState().playlistNoteDocument).toBe(before.playlistNoteDocument);
    expect(useWorkspaceStore.getState().pendingAiDrafts).toEqual(before.pendingAiDrafts);
    expect(notify.error).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().activeVideo?.aiMessage).toContain("30 seconds");
    expect(useWorkspaceStore.getState().activeVideo?.aiMessage).not.toMatch(/entertainment|non.educational|RAW_PROVIDER_PAYLOAD/i);
  });
});

describe("workspace state regressions", () => {
  it("stops processing after completion and does not resume it when the draft is discarded", async () => {
    api.getAiNoteJob.mockResolvedValue({ status: "COMPLETED", result: { ...video, aiStatus: "COMPLETED", cleanedTranscript: "AI notes" } });
    renderHook(() => useAiRefinement(vi.fn()));
    await act(async () => {});
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ content: "Original", aiStatus: "COMPLETED", aiJobId: null });
    act(() => useWorkspaceStore.getState().discardPendingAiDraft(video.videoId));
    expect(useWorkspaceStore.getState().activeVideo?.aiStatus).toBe("COMPLETED");
    expect(api.getAiNoteJob).toHaveBeenCalledOnce();
  });
  it("restores an unapplied AI draft after reload without starting AI", async () => {
    const source = { ...video, aiStatus: "COMPLETED" as const, aiJobId: null };
    const draft = { ...source, cleanedTranscript: "Saved AI notes" };
    useWorkspaceStore.getState().setActiveVideo(source);
    storage.getTranscriptSource.mockResolvedValue({ response: source, pendingAiDraft: draft });
    renderHook(() => useAiRefinement(vi.fn()));
    await act(async () => {});
    expect(useWorkspaceStore.getState().pendingAiDrafts.one).toEqual(draft);
    expect(api.refineTranscript).not.toHaveBeenCalled();
    expect(api.getAiNoteJob).not.toHaveBeenCalled();
  });
  it("ignores a late creation response after switching videos", async () => {
    useWorkspaceStore.getState().setActiveVideo({ ...video, aiStatus: "NOT_REQUESTED", aiJobId: null });
    let resolve!: (value: unknown) => void;
    api.refineTranscript.mockImplementation(() => new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => useAiRefinement(vi.fn()));
    let request!: Promise<void>;
    act(() => { request = result.current.startAiRefinement(); });
    act(() => useWorkspaceStore.getState().setActiveVideo({ ...video, videoId: "two", aiStatus: "NOT_REQUESTED", aiJobId: null }));
    expect(result.current.isStartingAi).toBe(false);
    await act(async () => { resolve(video); await request; });
    expect(useWorkspaceStore.getState().activeVideo?.videoId).toBe("two");
  });
  it("prevents duplicate requests from two clicks in the same render", async () => {
    useWorkspaceStore.getState().setActiveVideo({ ...video, aiStatus: "NOT_REQUESTED", aiJobId: null });
    api.refineTranscript.mockResolvedValue({ ...video, aiStatus: "NOT_REQUESTED", aiJobId: null });
    const { result } = renderHook(() => useAiRefinement(vi.fn()));
    await act(async () => { await Promise.all([result.current.startAiRefinement(), result.current.startAiRefinement()]); });
    expect(api.refineTranscript).toHaveBeenCalledOnce();
  });
  it.each([404, 503])("clears the spinner on status failure %s without submitting another AI job", async status => {
    vi.useFakeTimers();
    api.getAiNoteJob.mockRejectedValue(new ApiError("Status unavailable", { status }));
    renderHook(() => useAiRefinement(vi.fn()));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(14_000); });
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ aiStatus: "FAILED", aiJobId: status === 404 ? null : "job", content: "Original" });
    expect(api.refineTranscript).not.toHaveBeenCalled();
  });
  it("retains the selected language when restoring a workspace", () => {
    useWorkspaceStore.getState().setActiveVideo({ ...video, targetLanguage: "Hindi", aiStatus: "NOT_REQUESTED", aiJobId: null });
    const { result } = renderHook(() => useAiRefinement(vi.fn()));
    expect(result.current.targetLanguage).toBe("Hindi");
  });
  it("handles a failed job without a result payload", async () => {
    api.getAiNoteJob.mockResolvedValue({ status: "FAILED", message: "Generation failed" });
    renderHook(() => useAiRefinement(vi.fn()));
    await act(async () => {});
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({ aiStatus: "FAILED", aiJobId: null, content: "Original" });
  });
});

it("checks the same job on retry after a temporary polling failure", async () => {
  vi.useFakeTimers();
  api.getAiNoteJob.mockRejectedValue(new ApiError("Disconnected", { status: 503 }));
  const { result } = renderHook(() => useAiRefinement(vi.fn()));
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(14_000); });
  api.getAiNoteJob.mockResolvedValue({ status: "COMPLETED", result: { ...video, aiStatus: "COMPLETED" } });
  await act(async () => { await result.current.startAiRefinement(); });
  expect(api.refineTranscript).not.toHaveBeenCalled();
  expect(api.getAiNoteJob).toHaveBeenLastCalledWith("job");
  expect(useWorkspaceStore.getState().pendingAiDrafts.one).toBeDefined();
});

it("locks the selected language while verification is in flight", async () => {
  useWorkspaceStore.getState().setActiveVideo({ ...video, aiStatus:"NOT_REQUESTED", aiJobId:null });
  let resolve!: (value: TranscriptResponse) => void;
  api.refineTranscript.mockImplementation(() => new Promise<TranscriptResponse>(r => { resolve=r; }));
  const { result } = renderHook(() => useAiRefinement(vi.fn()));
  act(() => result.current.setTargetLanguage("Hindi"));
  let work!: Promise<void>;
  act(() => { work=result.current.startAiRefinement(); });
  act(() => result.current.setTargetLanguage("Hinglish"));
  expect(result.current.targetLanguage).toBe("Hindi");
  expect(api.refineTranscript).toHaveBeenCalledWith(expect.objectContaining({targetLanguage:"Hindi"}));
  await act(async () => { resolve({...video, aiStatus:"NOT_REQUESTED", aiJobId:null, targetLanguage:"Hindi"}); await work; });
});
it("persists a chosen language when the workspace hook remounts", () => {
  useWorkspaceStore.getState().setActiveVideo({ ...video, aiStatus:"NOT_REQUESTED", aiJobId:null });
  const first=renderHook(() => useAiRefinement(vi.fn()));
  act(() => first.result.current.setTargetLanguage("Hindi"));
  first.unmount();
  const next=renderHook(() => useAiRefinement(vi.fn()));
  expect(next.result.current.targetLanguage).toBe("Hindi");
  expect(localStorage.getItem("timesync-workspace-preferences-v2")).toContain("Hindi");
});

it.each(["Original", "", "   "])("defaults the source language marker %s to English for AI generation", async targetLanguage => {
  const raw = {...video, aiStatus:"NOT_REQUESTED" as const, aiJobId:null, targetLanguage};
  useWorkspaceStore.getState().setActiveVideo(raw);
  api.refineTranscript.mockResolvedValue({...raw, targetLanguage:"English"});
  const {result}=renderHook(() => useAiRefinement(vi.fn()));
  expect(result.current.targetLanguage).toBe("English");
  await act(async () => { await result.current.startAiRefinement(); });
  expect(api.refineTranscript).toHaveBeenCalledWith(expect.objectContaining({targetLanguage:"English"}));
});

describe("malformed and stale AI responses", () => {
  it.each([null, {...video, cleanedTranscript:" "}, {...video, videoId:"wrong"}])("rejects an unusable completed result", async draft => {
    api.getAiNoteJob.mockResolvedValue({status:"COMPLETED", result:draft});
    renderHook(() => useAiRefinement(vi.fn()));
    await act(async () => {});
    expect(useWorkspaceStore.getState().activeVideo).toMatchObject({aiStatus:"FAILED", aiJobId:null, content:"Original"});
    expect(useWorkspaceStore.getState().pendingAiDrafts).toEqual({});
    expect(storage.saveVideoWorkspace).not.toHaveBeenCalled();
  });
  it("does not submit another job while one is already queued", async () => {
    api.getAiNoteJob.mockImplementation(() => new Promise(() => {}));
    const {result}=renderHook(() => useAiRefinement(vi.fn()));
    await act(async () => { await result.current.startAiRefinement(); });
    expect(api.refineTranscript).not.toHaveBeenCalled();
  });
  it("does not display raw unexpected provider details", async () => {
    useWorkspaceStore.getState().setActiveVideo({...video, aiStatus:"NOT_REQUESTED", aiJobId:null});
    api.refineTranscript.mockRejectedValue(new Error("PRIVATE_PROVIDER_URL"));
    const {result}=renderHook(() => useAiRefinement(vi.fn()));
    await act(async () => { await result.current.startAiRefinement(); });
    expect(notify.error).toHaveBeenCalledWith("Unable to start AI", expect.not.stringContaining("PRIVATE_PROVIDER_URL"));
  });
});

it("ignores a late creation error after switching videos", async () => {
  useWorkspaceStore.getState().setActiveVideo({...video, aiStatus:"NOT_REQUESTED", aiJobId:null});
  let reject!: (error: Error) => void;
  api.refineTranscript.mockImplementation(() => new Promise((_, fail) => { reject=fail; }));
  const {result}=renderHook(() => useAiRefinement(vi.fn()));
  let work!: Promise<void>;
  act(() => { work=result.current.startAiRefinement(); });
  act(() => useWorkspaceStore.getState().setActiveVideo({...video, videoId:"two", aiStatus:"NOT_REQUESTED", aiJobId:null}));
  await act(async () => { reject(new Error("Private provider detail")); await work; });
  expect(notify.error).not.toHaveBeenCalled();
  expect(useWorkspaceStore.getState().activeVideo?.videoId).toBe("two");
});


it("recovers a transient progress failure without failing or resubmitting the job", async () => {
  vi.useFakeTimers();
  api.getAiNoteJob.mockRejectedValueOnce(new ApiError("Disconnected", { status: 503 }))
    .mockResolvedValue({ status: "COMPLETED", result: { ...video, aiStatus: "COMPLETED" } });
  renderHook(() => useAiRefinement(vi.fn()));
  await act(async () => {});
  expect(useWorkspaceStore.getState().activeVideo?.aiStatus).toBe("QUEUED");
  expect(notify.error).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  expect(useWorkspaceStore.getState().pendingAiDrafts.one).toBeDefined();
  expect(api.refineTranscript).not.toHaveBeenCalled();
});


it("keeps the polling interval when queued work starts processing", async () => {
  vi.useFakeTimers();
  api.getAiNoteJob.mockResolvedValue({ status: "PROCESSING" });
  renderHook(() => useAiRefinement(vi.fn()));
  await act(async () => {});
  expect(useWorkspaceStore.getState().activeVideo?.aiStatus).toBe("PROCESSING");
  expect(api.getAiNoteJob).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1_999); });
  expect(api.getAiNoteJob).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(api.getAiNoteJob).toHaveBeenCalledTimes(2);
});

it("stops polling on provider timeout and retains the backend retry cooldown", async () => {
  vi.useFakeTimers();
  api.getAiNoteJob.mockResolvedValue({
    status: "FAILED",
    message: "Gemini is temporarily unavailable. Retry in about 30 seconds.",
    retryAfterSeconds: 30,
    result: { ...video, aiStatus: "FAILED", retryAfterSeconds: 30 },
  });
  renderHook(() => useAiRefinement(vi.fn()));
  await act(async () => {});
  expect(useWorkspaceStore.getState().activeVideo).toMatchObject({
    aiStatus: "FAILED", aiJobId: null, retryAfterSeconds: 30,
    content: "Original", cleanedTranscript: "Original notes",
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(api.getAiNoteJob).toHaveBeenCalledTimes(1);
  expect(api.refineTranscript).not.toHaveBeenCalled();
});
