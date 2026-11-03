import { runProcess } from "./processManager";
import { openDB, DBSchema, type IDBPDatabase } from "idb";
import type { TranscriptResponse, PlaylistTranscriptResponse } from "@/features/extraction/types/extraction.types";
import type { PlaylistNoteDocument } from "@/features/workspace/types/workspace.types";
import { chapterAuthority } from "@/features/workspace/utils/chapterAuthority";
import { reconcileTranscript } from "@/features/extraction/utils/transcriptReconciliation";
import { hasUsableTranscriptEvidence } from "@/features/extraction/utils/transcriptEvidence";

interface TimeSyncDB extends DBSchema {
  drafts: {
    key: string;
    value: {
      videoId: string;
      videoTitle: string;
      content: string;
      updatedAt: number;
    };
    indexes: { "by-updated": number };
  };
  transcriptSources: {
    key: string;
    value: {
      videoId: string;
      response: TranscriptResponse;
      originalResponse?: TranscriptResponse;
      pendingAiDraft?: TranscriptResponse | null;
      updatedAt: number;
    };
    indexes: { "by-updated": number };
  };
  playlistDocuments: {
    key: string;
    value: PlaylistNoteDocument & { workspace?: PlaylistTranscriptResponse; activeVideoId?: string };
    indexes: { "by-updated": number };
  };
}

const DB_NAME = "timesync_notes_db";
const DB_VERSION = 3;
export const EDITOR_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const transcriptFallbackKey = (videoId: string) => `timesync-transcript-source:${videoId}`;
const draftFallbackKey = (videoId: string) => `timesync-editor-draft:${videoId}`;
const playlistFallbackKey = (playlistId: string) => `timesync-playlist-document:${playlistId}`;
type TranscriptSourceRecord = TimeSyncDB["transcriptSources"]["value"];
type EditorDraft = TimeSyncDB["drafts"]["value"];
type PlaylistDocumentRecord = TimeSyncDB["playlistDocuments"]["value"];

const readJsonFallback = <T>(key: string): T | undefined => {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : undefined;
  } catch {
    return undefined;
  }
};

const removeFallback = (key: string) => {
  try { window.localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
};

export const writeDraftRecoverySnapshot = (draft: EditorDraft) => {
  try { window.localStorage.setItem(draftFallbackKey(draft.videoId), JSON.stringify(draft)); return true; }
  catch { return false; }
};

export const writePlaylistDocumentRecoverySnapshot = (document: PlaylistDocumentRecord) => {
  try { window.localStorage.setItem(playlistFallbackKey(document.playlistId), JSON.stringify(document)); return true; }
  catch { return false; }
};

// Bound storage waits so a blocked browser database cannot freeze the workspace.
const storageOperation = async <T>(operation: Promise<T>): Promise<T> => runProcess("browser-storage", async () => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Browser storage did not respond.")), 1500);
    })]);
  } finally {
    clearTimeout(timer);
  }
});

const writeTranscriptFallback = (record: TranscriptSourceRecord): boolean => {
  try {
    const key = transcriptFallbackKey(record.videoId);
    window.localStorage.setItem(key, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
};

// Only prune copies already safely committed to IndexedDB, never unsaved recovery data.
const pruneTranscriptFallbacks = async (db: IDBPDatabase<TimeSyncDB>) => {
  try {
    const copies = Object.keys(window.localStorage).filter(key => key.startsWith("timesync-transcript-source:"))
      .map(key => ({ key, record: getTranscriptFallback(key.slice("timesync-transcript-source:".length)) }))
      .filter(item => item.record !== undefined).sort((a, b) => a.record!.updatedAt - b.record!.updatedAt);
    let remaining = copies.length;
    for (const { key, record } of copies) {
      if (remaining <= 20) break;
      const stored = await db.get("transcriptSources", record!.videoId);
      const latest = getTranscriptFallback(record!.videoId);
      if (stored && latest && stored.updatedAt >= latest.updatedAt) {
        window.localStorage.removeItem(key);
        remaining--;
      }
    }
  } catch { /* Retain recovery data if storage cannot be checked. */ }
};

const newestSource = (stored?: TranscriptSourceRecord, fallback?: TranscriptSourceRecord) =>
  fallback && (!stored || fallback.updatedAt >= stored.updatedAt) ? fallback : stored;

export const getTranscriptFallback = (videoId: string): TranscriptSourceRecord | undefined => {
  try {
    const raw = window.localStorage.getItem(transcriptFallbackKey(videoId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<TranscriptSourceRecord>;
    return parsed.videoId === videoId && parsed.response?.videoId === videoId && typeof parsed.response.content === "string" && Number.isFinite(parsed.updatedAt)
      ? parsed as TranscriptSourceRecord : undefined;
  } catch {
    return undefined;
  }
};

let connection: Promise<IDBPDatabase<TimeSyncDB>> | undefined;
export const initDB = async () => {
  connection ??= openDB<TimeSyncDB>(DB_NAME, DB_VERSION, {
    blocking() {
      const previous = connection;
      connection = undefined;
      void previous?.then(db => db.close());
    },
    terminated() { connection = undefined; },
    upgrade(db) {
      if (!db.objectStoreNames.contains("drafts")) {
        const store = db.createObjectStore("drafts", { keyPath: "videoId" });
        store.createIndex("by-updated", "updatedAt");
      }
      if (!db.objectStoreNames.contains("transcriptSources")) {
        const store = db.createObjectStore("transcriptSources", {
          keyPath: "videoId",
        });
        store.createIndex("by-updated", "updatedAt");
      }
      if (!db.objectStoreNames.contains("playlistDocuments")) {
        const store = db.createObjectStore("playlistDocuments", {
          keyPath: "playlistId",
        });
        store.createIndex("by-updated", "updatedAt");
      }
    },
  }).catch(error => { connection = undefined; throw error; });
  return storageOperation(connection);
};

const sourceWrites = new Map<string, Promise<unknown>>();
const serializeSourceWrite = <T>(videoId: string, write: () => Promise<T>) => {
  const previous = sourceWrites.get(videoId) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(write);
  sourceWrites.set(videoId, current);
  void current.finally(() => {
    if (sourceWrites.get(videoId) === current) sourceWrites.delete(videoId);
  }).catch(() => {});
  return current;
};

const persistSource = async (record: TranscriptSourceRecord) => {
  const fallbackSaved = writeTranscriptFallback(record);
  try {
    const db = await initDB();
    const tx = db.transaction("transcriptSources", "readwrite");
    const timer = setTimeout(() => { try { tx.abort(); } catch { /* Already committed. */ } }, 1500);
    try {
      const previous = await tx.store.get(record.videoId);
      if (!previous || previous.updatedAt <= record.updatedAt) await tx.store.put(record);
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* Already settled. */ }
      await tx.done.catch(() => {});
      throw error;
    } finally { clearTimeout(timer); }
    void pruneTranscriptFallbacks(db);
  } catch (error) {
    if (!fallbackSaved) throw error;
  }
};

export const saveTranscriptSource = async (response: TranscriptResponse) => {
  if (response.noteSource === "METADATA" || response.transcriptAvailability === "UNAVAILABLE" || !hasUsableTranscriptEvidence(response)) return;
  const source = chapterAuthority.apply(response);
  const record = { videoId: source.videoId, response: source, originalResponse: source, pendingAiDraft: null, updatedAt: Date.now() };
  writeTranscriptFallback(record);
  await serializeSourceWrite(source.videoId, () => persistSource(record));
};

export const getTranscriptSource = async (videoId: string) => {
  try {
    const stored = await storageOperation((async () => (await initDB()).get("transcriptSources", videoId))());
    return newestSource(stored, getTranscriptFallback(videoId));
  } catch (error) {
    const fallback = getTranscriptFallback(videoId);
    if (fallback) return fallback;
    throw error;
  }
};

// Incidental extraction still uses reconcileTranscript. An explicit workspace
// update may advance AI state only when evidence and its policy are unchanged.
const workspaceResponse = (existing: TranscriptResponse | undefined, incoming: TranscriptResponse) => {
  const sameEvidence = existing?.content === incoming.content
    && JSON.stringify(existing?.transcriptSegments) === JSON.stringify(incoming.transcriptSegments)
    && existing?.noteSource === incoming.noteSource;
  const samePolicy = existing?.verificationLevel === incoming.verificationLevel
    && existing?.contentEligibility === incoming.contentEligibility
    && existing?.contentReasonCode === incoming.contentReasonCode;
  return sameEvidence && samePolicy ? incoming : reconcileTranscript(existing, incoming)!;
};

export const saveVideoWorkspace = (response: TranscriptResponse, pendingAiDraft?: TranscriptResponse | null) => serializeSourceWrite(response.videoId, async () => {
  const existing = await getTranscriptSource(response.videoId).catch(() => undefined);
  const incomingMetadataOnly = response.noteSource === "METADATA" || response.transcriptAvailability === "UNAVAILABLE";
  const source = existing?.response && hasUsableTranscriptEvidence(existing.response) && incomingMetadataOnly
    ? existing.response : workspaceResponse(existing?.response, response);
  const originalResponse = (existing?.originalResponse && hasUsableTranscriptEvidence(existing.originalResponse) ? existing.originalResponse : undefined) ?? (source.cleaningStage !== "GEMINI_AI_REFINED" ? source : {
    ...source, cleanedTranscript: source.content, cleaningStage: "RAW_TRANSCRIPT" as const,
    aiStatus: "NOT_REQUESTED" as const, aiJobId: null,
  });
  await persistSource({ ...existing, videoId: response.videoId, response: chapterAuthority.apply(source), originalResponse,
    ...(pendingAiDraft !== undefined ? { pendingAiDraft } : {}), updatedAt: Date.now() });
});

export const savePlaylistWorkspace = async (workspace: PlaylistTranscriptResponse, activeVideoId?: string) => {
  const db = await initDB();
  const tx = db.transaction("playlistDocuments", "readwrite");
  const existing = await tx.store.get(workspace.playlistId);
  const now = Date.now();
  await tx.store.put({
    ...(existing ?? { playlistId: workspace.playlistId, title: workspace.playlistTitle,
      content: "", sections: [], createdAt: now, updatedAt: now }),
    workspace: chapterAuthority.applyPlaylist({ ...workspace, videoNotes: workspace.videoNotes.map((video) =>
      workspaceResponse(existing?.workspace?.videoNotes.find((saved) => saved.videoId === video.videoId), video)) }), activeVideoId,
  });
  await tx.done;
  // Imported evidence is restored ahead of playlist context. Keep its chapter
  // fields current too, without creating/replacing any transcript records.
  const sources = db.transaction("transcriptSources", "readwrite");
  for (const video of workspace.videoNotes) {
    const saved = await sources.store.get(video.videoId);
    if (!saved) continue;
    const response = chapterAuthority.apply(saved.response);
    if (response !== saved.response) {
      const updated = { ...saved, response,
        ...(saved.originalResponse ? { originalResponse: chapterAuthority.apply(saved.originalResponse) } : {}),
        updatedAt: Math.max(Date.now(), saved.updatedAt + 1) };
      await sources.store.put(updated);
      writeTranscriptFallback(updated);
    }
  }
  await sources.done;
  const latestDocument = await db.get("playlistDocuments", workspace.playlistId);
  if (latestDocument) writePlaylistDocumentRecoverySnapshot(latestDocument);
};

export const savePlaylistNoteDocument = async (
  document: PlaylistNoteDocument,
) => {
  writePlaylistDocumentRecoverySnapshot(document);
  const db = await initDB();
  const tx = db.transaction("playlistDocuments", "readwrite");
  const existing = await tx.store.get(document.playlistId);
  if (!existing || existing.updatedAt <= document.updatedAt) {
    await tx.store.put({ ...document, ...(existing?.workspace ? { workspace: existing.workspace, activeVideoId: existing.activeVideoId } : {}) });
  }
  await tx.done;
  const latestDocument = await db.get("playlistDocuments", document.playlistId);
  if (latestDocument) writePlaylistDocumentRecoverySnapshot(latestDocument);
};

export const getPlaylistNoteDocument = async (playlistId: string) => {
  const [stored, fallback] = await Promise.all([
    initDB().then(db => db.get("playlistDocuments", playlistId)).catch(() => undefined),
    Promise.resolve(readJsonFallback<PlaylistDocumentRecord>(playlistFallbackKey(playlistId))),
  ]);
  const validFallback = fallback?.playlistId === playlistId && typeof fallback.content === "string"
    && Number.isFinite(fallback.updatedAt) ? fallback : undefined;
  if (validFallback && (!stored || validFallback.updatedAt >= stored.updatedAt)) {
    return stored?.workspace && !validFallback.workspace
      ? { ...validFallback, workspace: stored.workspace, activeVideoId: stored.activeVideoId }
      : validFallback;
  }
  return stored;
};

export const deletePlaylistNoteDocument = async (playlistId: string) => {
  const db = await initDB();
  await db.delete("playlistDocuments", playlistId);
  removeFallback(playlistFallbackKey(playlistId));
};

export type Draft = EditorDraft;

export const getDraft = async (videoId: string) => {
  const [stored, fallback] = await Promise.all([
    initDB().then(db => storageOperation(db.get("drafts", videoId))).catch(() => undefined),
    Promise.resolve(readJsonFallback<Draft>(draftFallbackKey(videoId))),
  ]);
  const validFallback = fallback?.videoId === videoId && typeof fallback.content === "string"
    && Number.isFinite(fallback.updatedAt) ? fallback : undefined;
  return validFallback && (!stored || validFallback.updatedAt >= stored.updatedAt) ? validFallback : stored;
};

export const saveDraft = async (draft: Draft, isCurrent: () => boolean = () => true) => {
  if (isCurrent()) writeDraftRecoverySnapshot(draft);
  const db = await initDB();
  // Preserve the autosave generation check after opening the database.
  if (isCurrent()) await db.put("drafts", draft);
};

export const deleteDraft = async (videoId: string) => {
  const db = await initDB();
  await db.delete("drafts", videoId);
  removeFallback(draftFallbackKey(videoId));
};

export const getAllDrafts = async () => {
  const db = await initDB();
  const stored = await db.getAll("drafts");
  const latest = new Map(stored.map(draft => [draft.videoId, draft]));
  try {
    for (const key of Object.keys(window.localStorage).filter(key => key.startsWith("timesync-editor-draft:"))) {
      const fallback = readJsonFallback<Draft>(key);
      if (!fallback || fallback.videoId !== key.slice("timesync-editor-draft:".length)
        || typeof fallback.content !== "string" || !Number.isFinite(fallback.updatedAt)) continue;
      const previous = latest.get(fallback.videoId);
      if (!previous || fallback.updatedAt >= previous.updatedAt) latest.set(fallback.videoId, fallback);
    }
  } catch { /* Keep the IndexedDB results when local storage is unavailable. */ }
  return [...latest.values()];
};

/** Commit the applied draft and editor replacement together; failure preserves the pending draft. */
export const applyWorkspaceDraft = (response: TranscriptResponse, isCurrent: () => boolean,
  playlistDocument?: PlaylistNoteDocument, expectedPlaylistUpdatedAt?: number) => serializeSourceWrite(response.videoId, async () => {
  const db = await initDB();
  if (!isCurrent()) return false;
  const tx = db.transaction(["transcriptSources", "drafts", "playlistDocuments"], "readwrite");
  const timer = setTimeout(() => { try { tx.abort(); } catch { /* Already committed. */ } }, 1500);
  try {
    const stored = await tx.objectStore("transcriptSources").get(response.videoId);
    const existing = newestSource(stored, getTranscriptFallback(response.videoId));
    const playlist = playlistDocument ? await tx.objectStore("playlistDocuments").get(playlistDocument.playlistId) : undefined;
    if (!isCurrent() || (existing?.pendingAiDraft && JSON.stringify(existing.pendingAiDraft) !== JSON.stringify(response))
      || (playlist && expectedPlaylistUpdatedAt !== undefined && playlist.updatedAt > expectedPlaylistUpdatedAt)) {
      await tx.done;
      return false;
    }
    const appliedResponse = { ...response, aiJobId: null };
    const record: TranscriptSourceRecord = { ...existing, videoId: response.videoId,
      response: chapterAuthority.apply(appliedResponse), originalResponse: existing?.originalResponse ?? existing?.response,
      pendingAiDraft: null, updatedAt: Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1) };
    await tx.objectStore("transcriptSources").put(record);
    if (playlistDocument) {
      await tx.objectStore("playlistDocuments").put({ ...playlist, ...playlistDocument });
    } else {
      await tx.objectStore("drafts").delete(response.videoId);
    }
    if (!isCurrent()) { tx.abort(); await tx.done.catch(() => {}); return false; }
    await tx.done;
    // Remove stale recovery data before writing the committed snapshot.
    try { window.localStorage.removeItem(transcriptFallbackKey(response.videoId)); } catch { /* Storage disabled. */ }
    removeFallback(draftFallbackKey(response.videoId));
    writeTranscriptFallback(record);
    void pruneTranscriptFallbacks(db);
    return true;
  } catch (error) {
    try { tx.abort(); } catch { /* Already settled. */ }
    await tx.done.catch(() => {});
    throw error;
  } finally { clearTimeout(timer); }
});
