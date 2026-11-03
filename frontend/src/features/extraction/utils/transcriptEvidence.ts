import type { TranscriptResponse } from "../types/extraction.types";
import { isContentBlocked } from "./contentPolicy";

type Evidence = Partial<TranscriptResponse> | null | undefined;

/** Only source text/segments are evidence. cleanedTranscript may contain generated notes. */
export const transcriptEvidenceText = (video: Evidence): string => {
  if (typeof video?.content === "string" && video.content.trim()) return video.content.trim();
  return (Array.isArray(video?.transcriptSegments) ? video.transcriptSegments : [])
    .filter((segment) => typeof segment?.text === "string" && segment.text.trim())
    .map((segment) => segment.text.trim()).join("\n");
};

export const hasUsableTranscriptEvidence = (video: Evidence): boolean => Boolean(transcriptEvidenceText(video));

export const isMetadataWorkspace = (video: TranscriptResponse | null | undefined): boolean =>
  video?.noteSource === "METADATA" || video?.transcriptAvailability === "UNAVAILABLE";

/** Allows an explicit draft request; the server verifies evidence before generating anything. */
export const canRefineWithAi = (video: TranscriptResponse | null | undefined): boolean => {
  return hasUsableTranscriptEvidence(video) && !isMetadataWorkspace(video) && !isContentBlocked(video);
};
