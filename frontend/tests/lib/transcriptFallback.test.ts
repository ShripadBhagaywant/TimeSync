// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTranscriptFallback, getTranscriptSource, saveTranscriptSource } from "@/lib/indexDB";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";

const response = {
  videoId: "abcdefghijk", title: "Docker", content: "Docker tutorial", cleanedTranscript: "Docker tutorial",
  noteSource: "USER_PROVIDED", transcriptAvailability: "USER_PROVIDED", contentEligibility: "UNKNOWN", verificationLevel: "UNVERIFIED",
  transcriptSegments: [{ startSeconds: 0, durationSeconds: 0, text: "Docker tutorial" }], chapters: [], isEditableChapters: true,
} as unknown as TranscriptResponse;

const storage = vi.hoisted(() => ({ openDB: vi.fn() }));
vi.mock("idb", () => storage);
beforeEach(() => { localStorage.clear(); storage.openDB.mockRejectedValue(new Error("Storage unavailable")); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("immediate transcript refresh fallback", () => {
  it("writes the imported source before IndexedDB completes", async () => {
    await saveTranscriptSource(response);
    expect(getTranscriptFallback(response.videoId)?.response?.content).toBe("Docker tutorial");
  });
});

it("rejects a save when both browser storage mechanisms fail", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
  await expect(saveTranscriptSource(response)).rejects.toThrow("Storage unavailable");
});
it("restores the immediate snapshot when IndexedDB never responds", async () => {
  vi.useFakeTimers();
  storage.openDB.mockImplementation(() => new Promise(() => {}));
  const saving = saveTranscriptSource(response);
  expect(getTranscriptFallback(response.videoId)?.response.content).toBe(response.content);
  const restoring = getTranscriptSource(response.videoId);
  await vi.advanceTimersByTimeAsync(1500);
  await saving;
  expect((await restoring)?.response.content).toBe(response.content);
});
it("rejects a fallback record containing another video's response", () => {
  localStorage.setItem('timesync-transcript-source:' + response.videoId, JSON.stringify({ videoId: response.videoId, response: { ...response, videoId: 'different' }, updatedAt: Date.now() }));
  expect(getTranscriptFallback(response.videoId)).toBeUndefined();
});
