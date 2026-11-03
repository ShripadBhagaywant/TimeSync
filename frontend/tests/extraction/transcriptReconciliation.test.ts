import { describe, expect, it } from "vitest";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
import { reconcileTranscript } from "@/features/extraction/utils/transcriptReconciliation";
import { restoreVideo } from "@/features/workspace/utils/workspaceRestoration";
const legacy = { videoId: "one", title: "Lesson", content: "Source evidence", transcriptSegments: [], noteSource: "CAPTIONS" } as unknown as TranscriptResponse;
const verified = { ...legacy, contentEligibility: "EDUCATIONAL", verificationLevel: "SEMANTIC_VERIFIED", contentReasonCode: "SEMANTIC_EDUCATIONAL" } as TranscriptResponse;
const metadata = { ...legacy, content: "", noteSource: "METADATA", transcriptAvailability: "UNAVAILABLE", contentEligibility: "UNKNOWN", verificationLevel: "UNVERIFIED" } as TranscriptResponse;
describe("whole transcript and policy reconciliation", () => {
  it.each([[verified, metadata], [metadata, verified], [legacy, metadata], [metadata, legacy]])("keeps source evidence regardless of arrival order", (existing, incoming) => {
    expect(reconcileTranscript(existing, incoming)).toBe(existing === metadata ? incoming : existing);
  });
  it("replaces weak legacy evidence with a fresh verified response as a whole", () => {
    const fresh = { ...verified, content: "New verified evidence" };
    expect(reconcileTranscript(legacy, fresh)).toBe(fresh);
  });
  it("does not use unrelated video approval", () => {
    expect(reconcileTranscript(verified, { ...metadata, videoId: "two" })?.verificationLevel).toBe("UNVERIFIED");
  });
  it("keeps rejected backend decisions blocked", () => {
    const rejected = { ...verified, contentEligibility: "ENTERTAINMENT" as const };
    expect(reconcileTranscript(rejected, metadata)).toBe(rejected);
    expect(reconcileTranscript(verified, rejected)).toBe(rejected);
  });
  it("does not erase legacy source segments because availability is stale", () => {
    const restored = restoreVideo({ ...metadata, transcriptSegments: [{ startSeconds: 5, durationSeconds: 2, text: "Actual evidence" }] }, "one");
    expect(restored?.content).toBe("Actual evidence");
    expect(restored?.verificationLevel).toBe("UNVERIFIED");
  });
});
