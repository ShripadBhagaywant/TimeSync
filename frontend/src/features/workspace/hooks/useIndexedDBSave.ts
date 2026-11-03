// src/features/workspace/hooks/useIndexedDBSave.ts
import { useEffect, useRef, useState } from "react";
import { getDraft, saveDraft, deleteDraft } from "@/lib/indexDB";
import { notify } from "@/lib/toast";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Default TTL: 7 days in milliseconds
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000;

export const useIndexedDBSave = (
  videoId: string,
  videoTitle: string,
  content: string,
  delay: number = 1000,
  ttlMs: number = DEFAULT_TTL,
  enabled: boolean = true,
) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveGenerationRef = useRef(0);

  // 1. Check TTL on video load and purge expired draft automatically
  useEffect(() => {
    if (!videoId || !enabled) return;

    const purgeExpiredDraft = async () => {
      try {
        const existingDraft = await getDraft(videoId);

        if (existingDraft && existingDraft.updatedAt) {
          const isExpired = Date.now() - existingDraft.updatedAt > ttlMs;

          if (isExpired) {
            await deleteDraft(videoId);
            notify.info(
              "Draft Expired",
              "An outdated local draft was automatically removed.",
            );
          }
        }
      } catch (err) {
        console.error("Error checking draft TTL:", err);
      }
    };

    purgeExpiredDraft();
  }, [videoId, ttlMs, enabled]);

  // 2. Debounced save logic with updated timestamp
  useEffect(() => {
    if (!videoId || !enabled) {
      saveGenerationRef.current += 1;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      return;
    }

    const saveGeneration = ++saveGenerationRef.current;
    const savingStatusTimer = window.setTimeout(() => {
      if (saveGeneration === saveGenerationRef.current) {
        setSaveStatus("saving");
      }
    }, 0);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        await saveDraft({
          videoId,
          videoTitle,
          content,
          updatedAt: Date.now(), // Store updated timestamp for TTL tracking
        }, () => saveGeneration === saveGenerationRef.current);
        if (saveGeneration !== saveGenerationRef.current) return;
        setSaveStatus("saved");
      } catch (err) {
        if (saveGeneration !== saveGenerationRef.current) return;
        console.error("Failed to save to local storage:", err);
        setSaveStatus("error");
        notify.error(
          "Auto-save Failed",
          "Could not persist notes to local storage.",
        );
      }
    }, delay);

    return () => {
      clearTimeout(savingStatusTimer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      saveGenerationRef.current += 1;
    };
  }, [videoId, videoTitle, content, delay, enabled]);

  return { saveStatus: enabled && videoId ? saveStatus : "idle" as SaveStatus };
};
