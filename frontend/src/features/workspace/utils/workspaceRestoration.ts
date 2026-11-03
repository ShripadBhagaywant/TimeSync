import type { PlaylistTranscriptResponse, TranscriptResponse } from "@/features/extraction/types/extraction.types";
import { getDraft, getPlaylistNoteDocument, getTranscriptSource } from "@/lib/indexDB";
import { hasUsableTranscriptEvidence, transcriptEvidenceText } from "@/features/extraction/utils/transcriptEvidence";
import { reconcileTranscript } from "@/features/extraction/utils/transcriptReconciliation";

export type WorkspaceData = TranscriptResponse | PlaylistTranscriptResponse;

export const restoreVideo = (value: unknown, videoId: string): TranscriptResponse | null => {
  if (!value || typeof value !== "object" || typeof videoId !== "string" || !videoId.trim()) return null;
  const data = value as Partial<TranscriptResponse>;
  if (data.videoId !== videoId || typeof data.title !== "string" || !data.title.trim()) return null;
  const content = transcriptEvidenceText(data);
  const metadata = !hasUsableTranscriptEvidence(data) && (data.noteSource === "METADATA" || data.transcriptAvailability === "UNAVAILABLE");
  if (!metadata && !content.trim()) return null;
  return {
    ...data, videoId, title: data.title, content: metadata ? "" : content,
    channelName: typeof data.channelName === "string" ? data.channelName : "",
    thumbnailUrl: typeof data.thumbnailUrl === "string" ? data.thumbnailUrl : "",
    duration: typeof data.duration === "string" ? data.duration : "",
    cleanedTranscript: typeof data.cleanedTranscript === "string" ? data.cleanedTranscript : "",
    cleaningStage: data.cleaningStage ?? (metadata ? "METADATA_FALLBACK" : "RAW_TRANSCRIPT"),
    chapters: Array.isArray(data.chapters) ? data.chapters : [],
    transcriptSegments: Array.isArray(data.transcriptSegments) ? data.transcriptSegments : [],
    isEditableChapters: data.isEditableChapters ?? !data.chapters?.length,
    cachedResponse: data.cachedResponse ?? false,
    ...(metadata ? { noteSource: "METADATA", transcriptAvailability: "UNAVAILABLE", aiRefinementEnabled: false, aiStatus: "NOT_APPLICABLE" } : {}),
    ...(!data.aiJobId && ["QUEUED", "PROCESSING"].includes(data.aiStatus ?? "") ? { aiStatus: "NOT_REQUESTED" } : {}),
  };
};

const draftContext = (videoId: string, title: string) => restoreVideo({ videoId, title, noteSource: "METADATA" }, videoId)!;

export const restorePlaylist = (value: unknown, playlistId: string): PlaylistTranscriptResponse | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as PlaylistTranscriptResponse;
  if (data.playlistId !== playlistId || !Array.isArray(data.videoNotes) || !data.videoNotes.length) return null;
  const videos = data.videoNotes.map((video) => restoreVideo(video, video?.videoId));
  if (videos.some((video) => !video)) return null;
  return { ...data, videoNotes: videos as TranscriptResponse[], failures: data.failures ?? [] };
};

/** Editor drafts restore note context only; they are never transcript evidence. */
export const restoreLocalVideo = async (videoId: string) => {
  const [source, draft] = await Promise.allSettled([getTranscriptSource(videoId), getDraft(videoId)]);
  const video = source.status === "fulfilled" ? restoreVideo(source.value?.response, videoId) : null;
  if (video) return video;
  if (draft.status === "fulfilled" && draft.value?.videoId === videoId && typeof draft.value.content === "string" && draft.value.content.trim()) {
    return draftContext(videoId, draft.value.videoTitle || "Untitled Notes");
  }
  if (source.status === "rejected" || draft.status === "rejected") throw new Error("Local workspace unavailable");
  return null;
};

export const restoreLocalPlaylist = async (playlistId: string, selectedVideoId?: string) => {
  const document = await getPlaylistNoteDocument(playlistId);
  if (!document || document.playlistId !== playlistId) return null;
  let playlist = restorePlaylist(document.workspace, playlistId);
  if (!playlist && document.content?.trim()) {
    const entries = new Map((document.sections ?? []).map((section) => [section.videoId, section.videoTitle]));
    if (selectedVideoId && !entries.has(selectedVideoId)) entries.set(selectedVideoId, "Video notes");
    const videos = Array.from(entries, ([id, title]) => draftContext(id, title));
    if (videos.length) playlist = { playlistId, playlistTitle: document.title, playlistThumbnailUrl: "", videoNotes: videos,
      totalVideos: videos.length, attemptedVideos: videos.length, processedVideos: videos.length, captionVideos: 0,
      metadataVideos: videos.length, temporarilyUnavailableVideos: 0, failedVideos: 0, skippedVideos: 0,
      failures: [], truncated: false, stoppedEarly: false, maxVideos: videos.length, cachedResponse: false };
  }
  if (!playlist) return null;
  const videos = await Promise.all(playlist.videoNotes.map(async (video) => {
    const local = await restoreLocalVideo(video.videoId).catch(() => null);
    return reconcileTranscript(local, video)!;
  }));
  return { playlist: { ...playlist, videoNotes: videos }, document, activeVideoId: document.activeVideoId };
};
