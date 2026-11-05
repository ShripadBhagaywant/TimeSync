import { ApiError } from "@/lib/apiError";

const FRIENDLY_API_MESSAGES: Record<string, string> = {
  AI_PROVIDER_UNAVAILABLE:
    "Educational verification is temporarily unavailable. Please wait and retry.",
  AI_PROVIDER_QUOTA_EXCEEDED:
    "AI verification is temporarily rate-limited. Please wait and retry.",
  CAPTIONS_UNAVAILABLE:
    "This video cannot be processed because its transcript is unavailable.",
  NON_EDUCATIONAL_CONTENT:
    "This content could not be verified as educational or informational.",
  YOUTUBE_RATE_LIMITED:
    "YouTube is temporarily limiting transcript access. Please wait and retry.",
  YOUTUBE_BOT_CHECK:
    "YouTube temporarily blocked transcript access for this video. Please wait a moment and try again.",
  YOUTUBE_BUSY: "YouTube processing is busy right now. Please wait a moment and try again.",
  UPSTREAM_SERVICE_UNAVAILABLE:
    "YouTube is temporarily unavailable. Please retry shortly.",
  PLAYLIST_NOT_FOUND:
    "This playlist is private, unavailable, or cannot be accessed right now.",
  PLAYLIST_EMPTY: "This playlist has no publicly accessible videos.",
  PLAYLIST_QUEUE_BUSY:
    "Playlist processing is busy. Please wait briefly and submit again.",
  PLAYLIST_QUEUE_FULL:
    "The playlist queue is currently full. Please retry shortly.",
  PLAYLIST_CAPTIONS_UNAVAILABLE:
    "No videos in this playlist could be processed because their transcripts are unavailable.",
  PLAYLIST_NON_EDUCATIONAL_CONTENT:
    "None of the videos in this playlist appear to be educational content.",
  PLAYLIST_NO_PROCESSABLE_VIDEOS:
    "No public playlist videos could be prepared. Check the playlist visibility and try again.",
  STORAGE_UNAVAILABLE:
    "Sharing needs the database service. Start PostgreSQL (or the Docker services) and retry.",
  SHARE_SCHEMA_OUTDATED:
    "The sharing database schema is out of date. Restart the backend once, then retry the snapshot.",
};

export const getUserFacingApiError = (
  error: unknown,
  fallback: string,
): string => {
  if (error instanceof ApiError) {
    const friendly = error.code ? FRIENDLY_API_MESSAGES[error.code] : undefined;
    let message = error.code === "YOUTUBE_RATE_LIMITED"
      ? `YouTube is temporarily limiting transcript access. Retry in about ${error.retryAfterSeconds ?? 60} seconds.`
      : friendly || error.message || fallback;
    if (error.retryAfterSeconds != null) {
      if (error.code === "AI_PROVIDER_UNAVAILABLE") {
        message = `Educational verification is temporarily unavailable. Retry in about ${error.retryAfterSeconds} seconds.`;
      } else if (error.code === "AI_PROVIDER_QUOTA_EXCEEDED") {
        message = `AI verification is temporarily rate-limited. Retry in about ${error.retryAfterSeconds} seconds.`;
      }
    }
    return error.traceId ? `${message} Reference: ${error.traceId}` : message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

export const shouldRetryExtraction = (failureCount: number, error: unknown): boolean => {
  if (error instanceof ApiError && (
    ["YOUTUBE_RATE_LIMITED", "YOUTUBE_BUSY", "CAPTIONS_UNAVAILABLE", "YOUTUBE_BOT_CHECK"].includes(error.code ?? "")
    || (error.status !== undefined && error.status >= 400 && error.status < 500)
  )) return false;
  return failureCount < 1;
};
