// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWorkspaceRecovery } from "@/features/workspace/hooks/useWorkspaceRecovery";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";

const api = vi.hoisted(() => ({ importTranscript: vi.fn() }));
const db = vi.hoisted(() => ({ getTranscriptSource: vi.fn(), saveTranscriptSource: vi.fn(), getPlaylistNoteDocument: vi.fn() }));
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("@/features/extraction/api/extractionApi", () => ({ extractionApi: api }));
vi.mock("@/lib/indexDB", () => db);
vi.mock("@/lib/toast", () => ({ notify }));
const source = { channelName: "Teacher", thumbnailUrl: "", duration: "10:00", cleaningStage: "REGEX_SANITIZED", cachedResponse: false, videoId: "abcdefghijk", title: "Docker", content: "Docker tutorial", cleanedTranscript: "Docker tutorial",
  noteSource: "USER_PROVIDED", transcriptAvailability: "USER_PROVIDED", verificationLevel: "UNVERIFIED", contentEligibility: "UNKNOWN",
  transcriptSegments: [{ startSeconds: 0, durationSeconds: 0, text: "Docker tutorial" }], chapters: [], isEditableChapters: true,
} as TranscriptResponse;
beforeEach(() => {
  vi.resetAllMocks();
  useWorkspaceStore.getState().resetWorkspace();
  useWorkspaceStore.getState().setActiveVideo({ ...source, content: "", transcriptSegments: [], noteSource: "METADATA", transcriptAvailability: "UNAVAILABLE" });
  db.getTranscriptSource.mockResolvedValue(undefined);
  db.saveTranscriptSource.mockResolvedValue(undefined);
  api.importTranscript.mockResolvedValue(source);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("finishes parsing and closes the dialog while storage is still pending", async () => {
  vi.useFakeTimers();
  let finishSave!: () => void;
  db.saveTranscriptSource.mockReturnValue(new Promise<void>(resolve => { finishSave = resolve; }));
  const onImported = vi.fn();
  const { result } = renderHook(() => useWorkspaceRecovery(onImported, vi.fn()));
  let succeeded;
  await act(async () => { succeeded = await result.current.importTranscript("0:00\nDocker tutorial"); });
  expect(succeeded).toBe(true);
  expect(result.current.isImportingTranscript).toBe(false);
  expect(onImported).toHaveBeenCalledOnce();
  expect(useWorkspaceStore.getState().activeVideo?.content).toBe("Docker tutorial");
  expect(db.saveTranscriptSource).toHaveBeenCalledWith(source);
  act(() => vi.advanceTimersByTime(10_000));
  expect(notify.warning).toHaveBeenCalledWith("Transcript saving is delayed", expect.any(String));
  await act(async () => finishSave());
  expect(notify.success).toHaveBeenCalledWith("Transcript saved", expect.any(String));
});

it("preserves the parsed transcript and reports a storage failure separately", async () => {
  db.saveTranscriptSource.mockRejectedValue(new Error("Storage unavailable"));
  const onImported = vi.fn();
  const { result } = renderHook(() => useWorkspaceRecovery(onImported, vi.fn()));
  await act(async () => { expect(await result.current.importTranscript("Docker tutorial")).toBe(true); });
  expect(result.current.isImportingTranscript).toBe(false);
  expect(onImported).toHaveBeenCalledOnce();
  expect(notify.error).not.toHaveBeenCalled();
  expect(notify.warning).toHaveBeenCalledWith("Transcript not saved", expect.any(String));
  expect(useWorkspaceStore.getState().activeVideo?.content).toBe("Docker tutorial");
});

it("does not let an old storage read overwrite a newly imported transcript", async () => {
  let restore!: (value: unknown) => void;
  db.getTranscriptSource.mockReturnValue(new Promise(resolve => { restore = resolve; }));
  const { result } = renderHook(() => useWorkspaceRecovery(vi.fn(), vi.fn()));
  await act(async () => { await result.current.importTranscript("Docker tutorial"); });
  await act(async () => restore({ response: { ...source, content: "Old verified text", contentEligibility: "EDUCATIONAL", verificationLevel: "SEMANTIC_VERIFIED" } }));
  expect(useWorkspaceStore.getState().activeVideo?.content).toBe("Docker tutorial");
});
