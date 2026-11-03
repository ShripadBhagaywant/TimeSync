// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { applyWorkspaceDraft, getDraft, getTranscriptSource, initDB, saveDraft, saveTranscriptSource, saveVideoWorkspace } from "@/lib/indexDB";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";

const source = { videoId: "transaction", title: "Lesson", channelName: "Test", thumbnailUrl: "", duration: "00:10", cachedResponse: false, content: "Original transcript",
  cleanedTranscript: "Original transcript", cleaningStage: "RAW_TRANSCRIPT", noteSource: "USER_PROVIDED",
  chapters: [], isEditableChapters: true, transcriptSegments: [{ startSeconds: 0, durationSeconds: 10, text: "Original transcript" }] } as TranscriptResponse;
const draft = { ...source, cleanedTranscript: "Generated notes", cleaningStage: "GEMINI_AI_REFINED" as const };

beforeEach(async () => {
  localStorage.clear();
  const db = await initDB();
  const tx = db.transaction(["drafts", "transcriptSources", "playlistDocuments"], "readwrite");
  await Promise.all([tx.objectStore("drafts").clear(), tx.objectStore("transcriptSources").clear(), tx.objectStore("playlistDocuments").clear()]);
  await tx.done;
  await saveTranscriptSource(source);
  await saveVideoWorkspace(source, draft);
  await saveDraft({ videoId: source.videoId, videoTitle: source.title, content: "My editor content", updatedAt: Date.now() });
});
afterEach(() => vi.restoreAllMocks());

describe("atomic workspace draft application", () => {
  it("commits the response, pending state and editor replacement together", async () => {
    expect(await applyWorkspaceDraft(draft, () => true)).toBe(true);
    expect(await getDraft(source.videoId)).toBeUndefined();
    expect(await getTranscriptSource(source.videoId)).toMatchObject({ response: draft, originalResponse: source, pendingAiDraft: null });
  });

  it("rolls back the source update when deleting the old editor draft fails", async () => {
    vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(() => { throw new DOMException("Forced storage failure", "UnknownError"); });
    await expect(applyWorkspaceDraft(draft, () => true)).rejects.toThrow("Forced storage failure");
    expect((await getDraft(source.videoId))?.content).toBe("My editor content");
    expect(await getTranscriptSource(source.videoId)).toMatchObject({ response: source, pendingAiDraft: draft });
  });

  it("leaves storage untouched when the workspace is no longer current", async () => {
    expect(await applyWorkspaceDraft(draft, () => false)).toBe(false);
    expect((await getDraft(source.videoId))?.content).toBe("My editor content");
    expect((await getTranscriptSource(source.videoId))?.pendingAiDraft).toEqual(draft);
  });

  it("rejects an obsolete draft when a newer pending draft has been saved", async () => {
    const newer = { ...draft, cleanedTranscript: "Newer draft" };
    await saveVideoWorkspace(source, newer);
    expect(await applyWorkspaceDraft(draft, () => true)).toBe(false);
    expect((await getTranscriptSource(source.videoId))?.pendingAiDraft).toEqual(newer);
  });

  it("reuses the database connection", async () => {
    expect(await initDB()).toBe(await initDB());
  });
});
