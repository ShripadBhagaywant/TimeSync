import { useEffect, useRef, useState } from "react";
import { savePlaylistNoteDocument } from "@/lib/indexDB";
import type { PlaylistNoteDocument } from "../types/workspace.types";
import type { SaveStatus } from "./useIndexedDBSave";

export const usePlaylistDocumentSave = (
  document: PlaylistNoteDocument | null,
  enabled: boolean,
  delay = 600,
) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    if (!document || !enabled) return;

    const savingTimer = window.setTimeout(() => {
      if (generation === generationRef.current) setSaveStatus("saving");
    }, 0);
    const timer = window.setTimeout(async () => {
      try {
        await savePlaylistNoteDocument(document);
        if (generation === generationRef.current) setSaveStatus("saved");
      } catch (error) {
        console.error("Failed to save playlist notes:", error);
        if (generation === generationRef.current) setSaveStatus("error");
      }
    }, delay);

    return () => {
      generationRef.current += 1;
      window.clearTimeout(savingTimer);
      window.clearTimeout(timer);
    };
  }, [document, enabled, delay]);

  return { saveStatus: enabled && document ? saveStatus : "idle" as SaveStatus };
};
