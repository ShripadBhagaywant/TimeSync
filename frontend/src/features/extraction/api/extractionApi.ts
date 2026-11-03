import { runProcess } from "@/lib/processManager";
// features/extraction/api/extractionApi.ts
import { ApiError } from "@/lib/apiError";
import { apiClient } from "@/lib/axios";
import {
  ExtractVideoRequest,
  ExtractPlaylistRequest,
  TranscriptResponse,
  PlaylistTranscriptResponse,
  PlaylistJobResponse,
  AiNoteJobResponse,
  ImportTranscriptRequest,
  RefineTranscriptRequest,
} from "../types/extraction.types";

const PLAYLIST_JOB_TIMEOUT_MS = 60 * 60 * 1000;
const PLAYLIST_POLL_INTERVAL_MS = 2_000;

const wait = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const abort = () => { window.clearTimeout(timer); reject(signal.reason); };
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { signal.removeEventListener("abort", abort); abort(); }
  });

const waitForPlaylistJob = async (
  initialJob: PlaylistJobResponse,
  signal: AbortSignal,
): Promise<PlaylistTranscriptResponse> => {
  const deadline = Date.now() + PLAYLIST_JOB_TIMEOUT_MS;
  let job = initialJob;

  while (job.status === "QUEUED" || job.status === "PROCESSING") {
    signal.throwIfAborted();
    if (Date.now() >= deadline) {
      throw new ApiError(
        "Playlist processing is still running. Please retry from the workspace shortly.",
        { code: "PLAYLIST_JOB_TIMEOUT" },
      );
    }

    await wait(PLAYLIST_POLL_INTERVAL_MS, signal);
    const response = await apiClient.get<PlaylistJobResponse>(
      "/extract/playlist/jobs/" + encodeURIComponent(job.jobId),
      { timeout: 30_000, signal },
    );
    job = response.data;
  }

  if (job.status === "COMPLETED" && job.result) {
    return job.result;
  }

  throw new ApiError(job.errorMessage || "Playlist processing failed.", {
    code: job.errorCode || "PLAYLIST_PROCESSING_FAILED",
    traceId: job.traceId,
  });
};

export const extractionApi = {
  extractVideo: async (
    payload: ExtractVideoRequest,
  ): Promise<TranscriptResponse> => {
    return runProcess("video-extraction", async ({ signal }) => {
      const response = await apiClient.post<TranscriptResponse>(
        "/extract/video",
        payload,
        { signal },
      );
      return response.data;
    });
  },

  extractPlaylist: async (
    payload: ExtractPlaylistRequest,
  ): Promise<PlaylistTranscriptResponse> => {
    return runProcess("playlist-extraction", async ({ signal }) => {
      const response = await apiClient.post<PlaylistJobResponse>(
        "/extract/playlist/jobs",
        payload,
        { timeout: 30_000, signal },
      );
      return waitForPlaylistJob(response.data, signal);
    });
  },

  getVideo: async (videoId: string): Promise<TranscriptResponse> => {
    return runProcess("video-restoration", async ({ signal }) => {
      const response = await apiClient.get<TranscriptResponse>(
        "/extract/video/" + encodeURIComponent(videoId),
        { signal },
      );
      return response.data;
    });
  },

  getPlaylist: async (playlistId: string): Promise<PlaylistTranscriptResponse> => {
    return runProcess("playlist-restoration", async ({ signal }) => {
      const response = await apiClient.get<PlaylistTranscriptResponse>(
        "/extract/playlist/" + encodeURIComponent(playlistId),
        { timeout: PLAYLIST_JOB_TIMEOUT_MS, signal },
      );
      return response.data;
    });
  },

  getAiNoteJob: async (jobId: string): Promise<AiNoteJobResponse> => {
    return runProcess("ai-progress", async ({ signal }) => {
      const response = await apiClient.get<AiNoteJobResponse>(
        "/extract/ai/jobs/" + encodeURIComponent(jobId),
        { timeout: 30_000, signal },
      );
      return response.data;
    });
  },

  importTranscript: async (
    payload: ImportTranscriptRequest,
  ): Promise<TranscriptResponse> => {
    return runProcess("transcript-import", async ({ signal }) => {
      const response = await apiClient.post<TranscriptResponse>(
        "/extract/video/transcript",
        payload,
        { signal },
      );
      return response.data;
    });
  },

  refineTranscript: async (
    payload: RefineTranscriptRequest,
  ): Promise<TranscriptResponse> => {
    return runProcess("ai-verification", async ({ signal }) => {
      const response = await apiClient.post<TranscriptResponse>(
        "/extract/video/refine",
        payload,
        { signal },
      );
      return response.data;
    });
  },
};
