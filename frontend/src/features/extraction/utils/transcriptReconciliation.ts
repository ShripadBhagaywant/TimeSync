import type { TranscriptResponse } from "../types/extraction.types";
import { isContentBlocked, isContentVerified } from "./contentPolicy";
import { hasUsableTranscriptEvidence } from "./transcriptEvidence";

/** Select a complete evidence/policy pair, never splice approval onto different text. */
export function reconcileTranscript(
  existing: TranscriptResponse | null | undefined,
  incoming: TranscriptResponse | null | undefined,
): TranscriptResponse | null {
  if (!existing) return incoming ?? null;
  if (!incoming) return existing;
  if (existing.videoId !== incoming.videoId) return incoming;
  // A transient in-memory placeholder has no provenance to protect. Explicitly
  // persisted transcript sources do, even when their policy is still pending.
  if ((incoming.noteSource === "METADATA" || incoming.transcriptAvailability === "UNAVAILABLE")
    && !existing.noteSource && !existing.contentEligibility) return incoming;
  if (isContentBlocked(incoming)) return incoming;
  if (isContentBlocked(existing)) return existing;
  const strength = (video: TranscriptResponse) => hasUsableTranscriptEvidence(video)
    ? isContentVerified(video) ? 3 : 2 : 1;
  const oldStrength = strength(existing);
  const newStrength = strength(incoming);
  if (oldStrength !== newStrength) return oldStrength > newStrength ? existing : incoming;
  // Saved/active verified evidence and explicit imports survive incidental extraction.
  if (oldStrength === 3 || existing.noteSource === "USER_PROVIDED") return existing;
  return incoming;
}
