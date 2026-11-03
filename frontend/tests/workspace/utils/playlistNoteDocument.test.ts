import { describe, expect, it, vi } from "vitest";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
import {
  createPlaylistNoteDocument,
  hasPlaylistSection,
  upsertPlaylistAiSection,
} from "@/features/workspace/utils/playlistNoteDocument";

const draft = (videoId: string, title: string, notes: string): TranscriptResponse => ({
  videoId,
  title,
  channelName: "Channel",
  thumbnailUrl: "",
  content: "transcript",
  transcriptSegments: [],
  duration: "01:00",
  cleanedTranscript: notes,
  cleaningStage: "GEMINI_AI_REFINED",
  noteSource: "CAPTIONS",
  chapters: [],
  isEditableChapters: true,
  cachedResponse: false,
});

describe("playlist note documents", () => {
  it("keeps two video drafts in playlist order", () => {
    vi.spyOn(Date, "now").mockReturnValue(100);
    let document = createPlaylistNoteDocument("playlist-a", "Course");
    document = upsertPlaylistAiSection(document, draft("video-2", "Second", "## Two"), 1);
    document = upsertPlaylistAiSection(document, draft("video-1", "First", "## One"), 0);

    expect(document.sections.map((section) => section.videoId)).toEqual([
      "video-1",
      "video-2",
    ]);
    expect(document.content.indexOf("Video 1 — First")).toBeLessThan(
      document.content.indexOf("Video 2 — Second"),
    );
  });

  it("updates one video section without duplicating it or changing another", () => {
    let document = createPlaylistNoteDocument("playlist-a", "Course");
    document = upsertPlaylistAiSection(document, draft("video-1", "First", "old note"), 0);
    document = upsertPlaylistAiSection(document, draft("video-2", "Second", "keep me"), 1);
    document = {
      ...document,
      content: document.content.replace("keep me", "manually edited second note"),
    };
    document = upsertPlaylistAiSection(document, draft("video-1", "First", "new note"), 0);

    expect(document.content.match(/data-playlist-video-id="video-1"/g)).toHaveLength(1);
    expect(document.content).toContain("new note");
    expect(document.content).not.toContain("old note");
    expect(document.content).toContain("manually edited second note");
    expect(hasPlaylistSection(document, "video-1")).toBe(true);
  });

  it("isolates documents by playlist ID", () => {
    const first = upsertPlaylistAiSection(
      createPlaylistNoteDocument("playlist-a", "First"),
      draft("video-1", "One", "first playlist only"),
      0,
    );
    const second = createPlaylistNoteDocument("playlist-b", "Second");

    expect(first.content).toContain("first playlist only");
    expect(second.content).not.toContain("first playlist only");
  });
});
