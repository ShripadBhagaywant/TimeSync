// src/lib/cleanExpiredDrafts.ts
import { getAllDrafts, deleteDraft } from "@/lib/indexDB";

export const cleanExpiredDrafts = async (
  ttlMs: number = 7 * 24 * 60 * 60 * 1000,
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
