import type { PlaylistTranscriptResponse, TranscriptResponse } from "@/features/extraction/types/extraction.types";

type ChapterState = Pick<TranscriptResponse, "chapters" | "chapterAvailability" | "isEditableChapters">;

// Page-session provenance only: a reload still restores locally without extraction.
// Record only actual extraction responses, never hydrated or imported snapshots.
const responses = new Map<string, ChapterState>();
export const chapterAuthority = {
  remember(video: TranscriptResponse) {
    responses.set(video.videoId, {
      chapters: video.chapters,
      chapterAvailability: video.chapterAvailability,
      isEditableChapters: video.isEditableChapters,
    });
  },
  apply(video: TranscriptResponse): TranscriptResponse {
    const latest = responses.get(video.videoId);
    if (!latest || (video.chapters === latest.chapters && video.chapterAvailability === latest.chapterAvailability
      && video.isEditableChapters === latest.isEditableChapters)) return video;
    return { ...video, ...latest };
  },
  applyPlaylist(playlist: PlaylistTranscriptResponse): PlaylistTranscriptResponse {
    const videoNotes = playlist.videoNotes.map((video) => chapterAuthority.apply(video));
    return videoNotes.every((video, index) => video === playlist.videoNotes[index]) ? playlist : { ...playlist, videoNotes };
  },
  clear() { responses.clear(); },
};
