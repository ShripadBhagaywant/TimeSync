import { describe, expect, it } from "vitest";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
import { getChapterDisplay } from "@/features/workspace/utils/chapterDisplay";

const native = [{ title: "Native", startTimestampSeconds: 0, formattedTimestamp: "00:00" }];
const custom = [{ title: "Custom", startTimestampSeconds: 10, formattedTimestamp: "00:10" }];
const video = { chapters: native, isEditableChapters: true } as TranscriptResponse;

describe("chapter display provenance", () => {
  it.each(["NONE", "TEMPORARILY_UNAVAILABLE"] as const)("does not promote ambiguous legacy arrays to native for %s", (chapterAvailability) => {
    const legacy = { ...video, chapterAvailability, isEditableChapters: false };
    expect(getChapterDisplay(legacy)).toEqual({ chapters: [], source: "NONE" });
    expect(legacy.chapters).toEqual(native);
    expect(getChapterDisplay({ ...legacy, isEditableChapters: true }, custom)).toEqual({ chapters: custom, source: "CUSTOM" });
  });
  it("prioritizes verified native chapters even if editing is allowed", () => {
    expect(getChapterDisplay({ ...video, chapterAvailability: "AVAILABLE" }, custom)).toEqual({ chapters: native, source: "NATIVE" });
  });
  it.each(["NONE", "TEMPORARILY_UNAVAILABLE"] as const)("selects custom preferences for %s without modifying the response", (chapterAvailability) => {
    const source = { ...video, chapters: [], chapterAvailability };
    expect(getChapterDisplay(source, custom)).toEqual({ chapters: custom, source: "CUSTOM" });
    expect(source.chapters).toEqual([]);
  });
  it("keeps legacy custom preferences and source chapters distinct", () => {
    expect(getChapterDisplay(video, custom)).toEqual({ chapters: custom, source: "CUSTOM" });
    expect(video.chapters).toEqual(native);
  });
  it("respects an explicitly emptied custom set for legacy data", () => {
    expect(getChapterDisplay(video, [])).toEqual({ chapters: [], source: "NONE" });
  });
  it("does not display custom preferences when editing is disallowed", () => {
    expect(getChapterDisplay({ ...video, isEditableChapters: false }, custom)).toEqual({ chapters: native, source: "NATIVE" });
  });
  it("handles absent video safely", () => {
    expect(getChapterDisplay(null, custom)).toEqual({ chapters: [], source: "NONE" });
  });
});
