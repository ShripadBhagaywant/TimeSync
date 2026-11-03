import type { ChapterDto, TranscriptResponse } from "@/features/extraction/types/extraction.types";

export type ChapterDisplaySource = "NATIVE" | "CUSTOM" | "NONE";

/** Display-only selection; never merge preferences into the source response. */
export function getChapterDisplay(
  video: TranscriptResponse | null,
  customChapters?: ChapterDto[],
): { chapters: ChapterDto[]; source: ChapterDisplaySource } {
  const nativeChapters = video?.chapters ?? [];
  if (video?.chapterAvailability === "AVAILABLE" && nativeChapters.length > 0) {
    return { chapters: nativeChapters, source: "NATIVE" };
  }
  if (video?.isEditableChapters && customChapters !== undefined) {
    return { chapters: customChapters, source: customChapters.length ? "CUSTOM" : "NONE" };
  }
  // Older snapshots may contain a custom overlay. Preserve the stored array,
  // but an explicit absence/failure cannot establish native provenance.
  if (video?.chapterAvailability === "NONE" || video?.chapterAvailability === "TEMPORARILY_UNAVAILABLE") {
    return { chapters: [], source: "NONE" };
  }
  return { chapters: nativeChapters, source: nativeChapters.length ? "NATIVE" : "NONE" };
}
