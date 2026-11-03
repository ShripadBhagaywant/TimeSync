import type { TranscriptResponse } from "../types/extraction.types";

type Video = TranscriptResponse | null | undefined;

/** Interpret backend decisions only. Titles/categories are never policy inputs here. */
export const isContentBlocked = (video: Video): boolean =>
  video?.contentEligibility === "ENTERTAINMENT"
  || (video?.contentEligibility === "UNKNOWN" && video?.verificationLevel === "SEMANTIC_VERIFIED");

export const isContentVerified = (video: Video): boolean =>
  (video?.contentEligibility === "EDUCATIONAL" || video?.contentEligibility === "INFORMATIONAL")
  && video.verificationLevel === "SEMANTIC_VERIFIED";

export const canImportTranscript = (video: Video): boolean => Boolean(video) && !isContentBlocked(video);
