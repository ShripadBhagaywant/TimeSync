import { isContentVerified } from "@/features/extraction/utils/contentPolicy";
import { describe, expect, it } from "vitest";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
import { canRefineWithAi, isMetadataWorkspace, hasUsableTranscriptEvidence } from "@/features/extraction/utils/transcriptEvidence";
const video = { content: "Transcript evidence", noteSource: "CAPTIONS", transcriptAvailability: "AVAILABLE", contentEligibility: "EDUCATIONAL", verificationLevel: "SEMANTIC_VERIFIED" } as TranscriptResponse;
describe("transcript evidence for AI controls", () => {
  it("accepts source segments but never chapters or generated editor output", () => {
    expect(hasUsableTranscriptEvidence({ transcriptSegments: [{ startSeconds: 0, durationSeconds: 2, text: "Source" }] })).toBe(true);
    expect(hasUsableTranscriptEvidence({ cleanedTranscript: "Generated notes", chapters: [{ title: "Intro", startTimestampSeconds: 0, formattedTimestamp: "00:00" }] })).toBe(false);
  });
  it("recognizes source evidence independently of stale availability labels", () => {
    const metadata = { ...video, noteSource: "METADATA", aiRefinementEnabled: true } as TranscriptResponse;
    expect(isMetadataWorkspace(metadata)).toBe(true);
    expect(canRefineWithAi(metadata)).toBe(false);
    expect(canRefineWithAi({ ...metadata, verificationLevel: "UNVERIFIED" })).toBe(false);
    expect(canRefineWithAi({ ...video, transcriptAvailability: "UNAVAILABLE" })).toBe(false);
  });
  it("allows available and imported evidence, but never empty content", () => {
    expect(canRefineWithAi(video)).toBe(true);
    expect(canRefineWithAi({ ...video, noteSource: "USER_PROVIDED", transcriptAvailability: "USER_PROVIDED" })).toBe(true);
    expect(canRefineWithAi({ ...video, content: " " })).toBe(false);
    expect(canRefineWithAi(null)).toBe(false);
  });
  it("retains support for saved transcripts predating availability", () => {
    expect(canRefineWithAi({ ...video, transcriptAvailability: undefined })).toBe(true);
  });
  it("does not treat missing legacy policy fields as approval", () => {
    const legacy = { ...video, contentEligibility: undefined, verificationLevel: undefined };
    expect(canRefineWithAi(legacy)).toBe(true);
    expect(isContentVerified(legacy)).toBe(false);
  });
  it.each(["EDUCATIONAL", "INFORMATIONAL"] as const)("allows verified %s independently of title", (contentEligibility) => {
    expect(canRefineWithAi({ ...video, contentEligibility, title: "Official Music Video" })).toBe(true);
  });
  it.each(["ENTERTAINMENT", "UNKNOWN"] as const)("disables AI for %s even with an enabled legacy flag", (contentEligibility) => {
    expect(canRefineWithAi({ ...video, contentEligibility, aiRefinementEnabled: true })).toBe(false);
  });
  it("does not treat educational metadata as semantic approval", () => {
    const pending = { ...video, verificationLevel: "METADATA_VERIFIED" as const };
    expect(canRefineWithAi(pending)).toBe(true);
    expect(isContentVerified(pending)).toBe(false);
  });
});
