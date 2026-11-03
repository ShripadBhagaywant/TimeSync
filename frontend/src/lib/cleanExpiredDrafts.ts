// src/lib/cleanExpiredDrafts.ts
import { EDITOR_DRAFT_TTL_MS, getAllDrafts, deleteDraft } from "@/lib/indexDB";

export const cleanExpiredDrafts = async (
  ttlMs: number = EDITOR_DRAFT_TTL_MS,
) => {
  try {
    const allDrafts = await getAllDrafts();
    const now = Date.now();

    for (const draft of allDrafts) {
      if (draft.updatedAt && now - draft.updatedAt > ttlMs) {
        await deleteDraft(draft.videoId);
      }
    }
  } catch (err) {
    console.error("Failed to run draft garbage collection:", err);
  }
};
