export type YouTubeInputKind = "video" | "playlist";

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const PLAYLIST_ID_PATTERN = /^[a-zA-Z0-9_-]{12,100}$/;
const VIDEO_PATH_PREFIXES = new Set(["shorts", "embed", "live", "v"]);

const parseUrl = (input: string): URL | null => {
  try {
    const value = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)
      ? input
      : "https://" + input;
    return new URL(value);
  } catch {
    return null;
  }
};

const isYouTubeHost = (hostname: string) =>
  hostname === "youtube.com" ||
  hostname.endsWith(".youtube.com") ||
  hostname === "youtube-nocookie.com" ||
  hostname.endsWith(".youtube-nocookie.com") ||
  hostname === "youtu.be" ||
  hostname.endsWith(".youtu.be");

export const extractYouTubeVideoId = (input: string): string | null => {
  const trimmed = input.trim();
  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

  const url = parseUrl(trimmed);
  if (!url || !isYouTubeHost(url.hostname.toLowerCase())) return null;

  const hostname = url.hostname.toLowerCase();
  if (hostname === "youtu.be" || hostname.endsWith(".youtu.be")) {
    const candidate = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
  }

  const queryCandidate = url.searchParams.get("v") ?? "";
  if (VIDEO_ID_PATTERN.test(queryCandidate)) return queryCandidate;

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const pathPrefix = pathSegments[0] ?? "";
  const pathCandidate = pathSegments[1] ?? "";
  if (
    pathSegments.length >= 2 &&
    VIDEO_PATH_PREFIXES.has(pathPrefix.toLowerCase()) &&
    VIDEO_ID_PATTERN.test(pathCandidate)
  ) {
    return pathCandidate;
  }

  return null;
};

export const extractYouTubePlaylistId = (input: string): string | null => {
  const trimmed = input.trim();
  if (PLAYLIST_ID_PATTERN.test(trimmed) && !VIDEO_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const url = parseUrl(trimmed);
  if (!url || !isYouTubeHost(url.hostname.toLowerCase())) return null;

  const candidate = url.searchParams.get("list") ?? "";
  return PLAYLIST_ID_PATTERN.test(candidate) ? candidate : null;
};

export const classifyYouTubeInput = (
  input: string,
): YouTubeInputKind | null => {
  if (extractYouTubePlaylistId(input)) return "playlist";
  if (extractYouTubeVideoId(input)) return "video";
  return null;
};
