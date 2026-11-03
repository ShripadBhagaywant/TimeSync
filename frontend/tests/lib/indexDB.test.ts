// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";

const database = vi.hoisted(() => ({
  transcriptSources: new Map<string, unknown>(),
  playlistDocuments: new Map<string, unknown>(),
}));

vi.mock("idb", () => ({
  openDB: vi.fn(async () => ({
    transaction: (storeName: "transcriptSources" | "playlistDocuments") => ({
      store: {
        get: async (key: string) => database[storeName].get(key),
        put: async (value: { videoId?: string; playlistId?: string }) => database[storeName].set((value.videoId ?? value.playlistId)!, value),
      },
      done: Promise.resolve(),
    }),
    put: async (storeName: string, value: { videoId?: string; playlistId?: string }) => {
      if (storeName === "transcriptSources") {
        database.transcriptSources.set(value.videoId!, value);
      }
      if (storeName === "playlistDocuments") {
        database.playlistDocuments.set(value.playlistId!, value);
      }
    },
    get: async (storeName: string, key: string) =>
      storeName === "transcriptSources"
        ? database.transcriptSources.get(key)
        : storeName === "playlistDocuments"
          ? database.playlistDocuments.get(key)
          : undefined,
  })),
}));

import {
  getPlaylistNoteDocument,
  getTranscriptSource,
  savePlaylistNoteDocument,
  saveTranscriptSource,
  saveVideoWorkspace,
  savePlaylistWorkspace,
} from "@/lib/indexDB";
import { restoreLocalVideo, restoreLocalPlaylist } from "@/features/workspace/utils/workspaceRestoration";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
import { getChapterDisplay } from "@/features/workspace/utils/chapterDisplay";
import { createPlaylistNoteDocument } from "@/features/workspace/utils/playlistNoteDocument";
import { chapterAuthority } from "@/features/workspace/utils/chapterAuthority";

beforeEach(() => chapterAuthority.clear());

const response: TranscriptResponse = {
  videoId: "yE6tIle64tU",
  title: "SQL Tutorial",
  channelName: "Test Channel",
  thumbnailUrl: "",
  content: "0:00 Introduction",
  transcriptSegments: [
    { startSeconds: 0, durationSeconds: 4, text: "Introduction" },
  ],
  duration: "10:00",
  cleanedTranscript: "Introduction",
  cleaningStage: "RAW_TRANSCRIPT",
  noteSource: "USER_PROVIDED",
  chapters: [],
  isEditableChapters: true,
  cachedResponse: false,
};

describe("IndexedDB transcript persistence", () => {
  it("refreshes imported evidence's chapter fields without replacing transcript content", async () => {
    await saveTranscriptSource({ ...response, chapterAvailability: "AVAILABLE", isEditableChapters: false,
      chapters: [{ title: "Old chapter", startTimestampSeconds: 0, formattedTimestamp: "00:00" }] });
    const fresh: TranscriptResponse = { ...response, noteSource: "CAPTIONS", content: "Different evidence", chapterAvailability: "TEMPORARILY_UNAVAILABLE" };
    chapterAuthority.remember(fresh);
    await saveVideoWorkspace(fresh);
    const saved = (await getTranscriptSource(response.videoId))!.response;
    expect(saved).toMatchObject({ content: response.content, noteSource: "USER_PROVIDED", chapters: [], chapterAvailability: "TEMPORARILY_UNAVAILABLE", isEditableChapters: true });
    chapterAuthority.clear();
    expect((await restoreLocalVideo(response.videoId))?.chapters).toEqual([]);
  });

  it("applies current chapters after an old snapshot save has already started", async () => {
    const stale = { ...response, chapters: [{ title: "Stale", startTimestampSeconds: 0, formattedTimestamp: "00:00" }] };
    const pending = saveVideoWorkspace(stale);
    chapterAuthority.remember({ ...response, chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
    await pending;
    expect((await getTranscriptSource(response.videoId))?.response).toMatchObject({ chapters: [], chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
  });

  it("keeps playlist master content while correcting each fresh video's snapshot", async () => {
    const playlist = { playlistId: "fresh-playlist", playlistTitle: "Course", videoNotes: [{ ...response, chapters: [{ title: "Stale", startTimestampSeconds: 0, formattedTimestamp: "00:00" }] }] } as import("@/features/extraction/types/extraction.types").PlaylistTranscriptResponse;
    await savePlaylistNoteDocument({ ...createPlaylistNoteDocument("fresh-playlist", "Course"), content: "<p>Master edits</p>" });
    await saveTranscriptSource({ ...response, chapters: playlist.videoNotes[0]!.chapters });
    chapterAuthority.remember({ ...response, chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
    await savePlaylistWorkspace(playlist, response.videoId);
    const saved = await getPlaylistNoteDocument("fresh-playlist");
    expect(saved?.content).toBe("<p>Master edits</p>");
    expect(saved?.workspace?.videoNotes[0]).toMatchObject({ chapters: [], chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
    chapterAuthority.clear();
    const restored = await restoreLocalPlaylist("fresh-playlist");
    expect(restored?.playlist.videoNotes[0]).toMatchObject({ content: response.content, noteSource: "USER_PROVIDED", chapters: [], chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
  });
  it("persists only source chapters after custom edits for single videos and playlists", async () => {
    const source: TranscriptResponse = { ...response, chapterAvailability: "TEMPORARILY_UNAVAILABLE" };
    const custom = [{ title: "My marker", startTimestampSeconds: 4, formattedTimestamp: "00:04" }];
    const playlist = { playlistId: "provenance", playlistTitle: "Course", videoNotes: [source] } as import("@/features/extraction/types/extraction.types").PlaylistTranscriptResponse;
    useWorkspaceStore.setState({ videoPreferences: {} });
    useWorkspaceStore.getState().setPlaylistData(playlist);
    useWorkspaceStore.getState().setActiveVideo(source);
    useWorkspaceStore.getState().setEditableChapters(custom);
    await saveVideoWorkspace(useWorkspaceStore.getState().activeVideo!);
    await savePlaylistWorkspace(useWorkspaceStore.getState().playlistData!, source.videoId);
    expect((await getTranscriptSource(source.videoId))?.response.chapters).toEqual([]);
    expect((await getPlaylistNoteDocument("provenance"))?.workspace?.videoNotes[0]?.chapters).toEqual([]);
    expect(JSON.parse(localStorage.getItem("timesync-workspace-preferences-v2")!).state.videoPreferences[source.videoId].customChapters).toEqual(custom);
    useWorkspaceStore.getState().resetWorkspace();
    const restored = await restoreLocalVideo(source.videoId);
    useWorkspaceStore.getState().setActiveVideo(restored);
    expect(restored?.chapterAvailability).toBe("TEMPORARILY_UNAVAILABLE");
    expect(getChapterDisplay(restored, useWorkspaceStore.getState().videoPreferences[source.videoId]?.customChapters)).toEqual({ chapters: custom, source: "CUSTOM" });
  });

  it("preserves chapter availability through storage and video restoration", async () => {
    const temporary: TranscriptResponse = { ...response, chapterAvailability: "TEMPORARILY_UNAVAILABLE" };
    await saveVideoWorkspace(temporary);
    expect((await getTranscriptSource(response.videoId))?.response.chapterAvailability).toBe("TEMPORARILY_UNAVAILABLE");
    expect(await restoreLocalVideo(response.videoId)).toMatchObject({
      chapterAvailability: "TEMPORARILY_UNAVAILABLE", chapters: [], isEditableChapters: true,
    });
  });

  it("preserves each playlist video's chapter availability through restoration", async () => {
    const playlist = { playlistId: "availability", playlistTitle: "Course", videoNotes: [
      { ...response, chapterAvailability: "TEMPORARILY_UNAVAILABLE" },
      { ...response, videoId: "second", chapterAvailability: "NONE" },
    ] } as import("@/features/extraction/types/extraction.types").PlaylistTranscriptResponse;
    await savePlaylistWorkspace(playlist, response.videoId);
    const restored = await restoreLocalPlaylist(playlist.playlistId);
    expect(restored?.playlist.videoNotes.map(video => video.chapterAvailability)).toEqual(["TEMPORARILY_UNAVAILABLE", "NONE"]);
    expect(restored?.activeVideoId).toBe(response.videoId);
  });

  it("restores legacy data without inventing a chapter availability", async () => {
    await saveVideoWorkspace(response);
    const restored = await restoreLocalVideo(response.videoId);
    expect(restored?.chapterAvailability).toBeUndefined();
    expect(restored?.isEditableChapters).toBe(true);
  });

  it("saves metadata workspace context without overwriting imported evidence", async () => {
    const metadata = { ...response, noteSource: "METADATA" as const, content: "", transcriptAvailability: "UNAVAILABLE" as const };
    await saveVideoWorkspace(metadata);
    expect((await getTranscriptSource(response.videoId))?.response).toEqual(metadata);
    await saveTranscriptSource(response);
    await saveVideoWorkspace(metadata);
    expect((await getTranscriptSource(response.videoId))?.response).toEqual(response);
  });
  it("keeps playlist snapshots and master edits independent", async () => {
    const playlist = { playlistId: "course", playlistTitle: "Course", videoNotes: [response] } as import("@/features/extraction/types/extraction.types").PlaylistTranscriptResponse;
    await savePlaylistWorkspace(playlist, response.videoId);
    const document = { ...createPlaylistNoteDocument("course", "Edited title"), content: "<p>My master notes</p>" };
    await savePlaylistNoteDocument(document);
    expect(await getPlaylistNoteDocument("course")).toMatchObject({ ...document, workspace: playlist });
    await savePlaylistWorkspace({ ...playlist, playlistTitle: "New metadata" }, response.videoId);
    expect(await getPlaylistNoteDocument("course")).toMatchObject({ content: document.content, title: document.title });
  });
  it("does not replace an imported source with a metadata-only or empty response", async () => {
    await saveTranscriptSource(response);
    await saveTranscriptSource({ ...response, content: "", noteSource: "METADATA", transcriptAvailability: "UNAVAILABLE" });
    await expect(getTranscriptSource(response.videoId)).resolves.toMatchObject({ response });
  });

  beforeEach(() => {
    localStorage.clear();
    database.transcriptSources.clear();
    database.playlistDocuments.clear();
  });

  it("round-trips a user-provided transcript source by video ID", async () => {
    await saveTranscriptSource(response);

    const saved = await getTranscriptSource(response.videoId);

    expect(saved?.videoId).toBe(response.videoId);
    expect(saved?.response).toEqual(response);
    expect(saved?.updatedAt).toBeTypeOf("number");
  });

  it("does not return one video's transcript for another video", async () => {
    await saveTranscriptSource(response);

    await expect(getTranscriptSource("aircAruvnKk")).resolves.toBeUndefined();
  });

  it("round-trips and isolates playlist master documents by playlist ID", async () => {
    const document = {
      ...createPlaylistNoteDocument("playlist-a", "Course"),
      content: '<h2>Video 1</h2><p data-indent="2">Indented notes</p><h2>Video 2</h2><p>Second notes</p>',
    };
    await savePlaylistNoteDocument(document);

    await expect(getPlaylistNoteDocument("playlist-a")).resolves.toEqual(document);
    await expect(getPlaylistNoteDocument("playlist-b")).resolves.toBeUndefined();
  });
});

describe("workspace draft recovery", () => {
  beforeEach(() => { localStorage.clear(); database.transcriptSources.clear(); });
  it("persists AI progress for the same verified evidence without replacing its original source", async () => {
    const verified = { ...response, contentEligibility: "EDUCATIONAL" as const, verificationLevel: "SEMANTIC_VERIFIED" as const };
    await saveTranscriptSource(verified);
    await saveVideoWorkspace({ ...verified, aiStatus: "QUEUED", aiJobId: "job", targetLanguage: "Hindi" });
    const saved = await getTranscriptSource(response.videoId);
    expect(saved?.response).toMatchObject({ aiStatus: "QUEUED", aiJobId: "job", targetLanguage: "Hindi" });
    expect(saved?.originalResponse).toEqual(verified);
  });
  it("recovers a pending draft and clears it durably on discard", async () => {
    const draft = { ...response, aiStatus: "COMPLETED" as const, cleanedTranscript: "Generated notes" };
    await saveTranscriptSource(response);
    await saveVideoWorkspace({ ...response, aiStatus: "COMPLETED", aiJobId: null }, draft);
    expect((await getTranscriptSource(response.videoId))?.pendingAiDraft).toEqual(draft);
    await saveVideoWorkspace({ ...response, aiStatus: "COMPLETED", aiJobId: null }, null);
    expect((await getTranscriptSource(response.videoId))?.pendingAiDraft).toBeNull();
    expect((await getTranscriptSource(response.videoId))?.originalResponse).toEqual(response);
  });
  it("serializes background workspace saves without resurrecting a discarded draft", async () => {
    const draft = { ...response, cleanedTranscript: "Generated notes" };
    await saveTranscriptSource(response);
    await Promise.all([saveVideoWorkspace(response, draft), saveVideoWorkspace(response, null), saveVideoWorkspace(response)]);
    expect((await getTranscriptSource(response.videoId))?.pendingAiDraft).toBeNull();
  });
  it("prefers a newer fallback to an older IndexedDB transcript", async () => {
    await saveTranscriptSource(response);
    const stored = await getTranscriptSource(response.videoId);
    const newer = { ...stored, updatedAt: stored!.updatedAt + 100, response: { ...response, content: "New import" } };
    localStorage.setItem('timesync-transcript-source:' + response.videoId, JSON.stringify(newer));
    expect((await getTranscriptSource(response.videoId))?.response.content).toBe("New import");
  });
});
