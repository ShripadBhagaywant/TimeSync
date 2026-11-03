import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkspaceStore } from "../store/workspaceStore";
import { extractionApi } from "@/features/extraction/api/extractionApi";
import { getPlaylistNoteDocument, getTranscriptSource, saveTranscriptSource } from "@/lib/indexDB";
import { notify } from "@/lib/toast";
import { notifyApiError } from "@/lib/apiErrorNotifications";
import { canImportTranscript } from "@/features/extraction/utils/contentPolicy";
import { getUserFacingApiError } from "@/features/extraction/utils/extractionErrors";
import { reconcileTranscript } from "@/features/extraction/utils/transcriptReconciliation";

export function useWorkspaceRecovery(onImported: () => void, setEditorRevision: Dispatch<SetStateAction<number>>, isHydrating = false) {
  const { activeVideo, playlistData, playlistDocumentHydrated, hydratePlaylistNoteDocument, replaceVideoResponse } = useWorkspaceStore(useShallow(state => ({
    activeVideo: state.activeVideo, playlistData: state.playlistData,
    playlistDocumentHydrated: state.playlistDocumentHydrated,
    hydratePlaylistNoteDocument: state.hydratePlaylistNoteDocument, replaceVideoResponse: state.replaceVideoResponse,
  })));
  const [isImportingTranscript, setIsImportingTranscript] = useState(false);
  const importingRef = useRef(false);
  const importedRevision = useRef(0);
  const activeVideoId = activeVideo?.videoId;

  useEffect(() => {
    const playlistId = playlistData?.playlistId;
    if (!playlistId || playlistDocumentHydrated) return;
    let cancelled = false;
    void getPlaylistNoteDocument(playlistId).then((saved) => {
      if (cancelled) return;
      hydratePlaylistNoteDocument(playlistId, saved);
      setEditorRevision((value) => value + 1);
    }).catch(() => {
      if (cancelled) return;
      hydratePlaylistNoteDocument(playlistId);
      console.warn("Local playlist document restoration unavailable.");
    });
    return () => {
      cancelled = true;
    };
  }, [
    hydratePlaylistNoteDocument,
    playlistData?.playlistId,
    playlistDocumentHydrated,
    setEditorRevision,
  ]);

  useEffect(() => {
    if (!activeVideoId || isHydrating) return;
    const revision = importedRevision.current;
    let cancelled = false;
    void getTranscriptSource(activeVideoId).then((saved) => {
      const current = useWorkspaceStore.getState().activeVideo;
      if (cancelled || current?.videoId !== activeVideoId || revision !== importedRevision.current) return;
      const selected = reconcileTranscript(current, saved?.response);
      if (selected && selected !== current) replaceVideoResponse(selected);
    }).catch(() => {
      console.warn("Local transcript restoration unavailable.");
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeVideoId,
    isHydrating,
    replaceVideoResponse,
  ]);

  const importTranscript = useCallback(
    async (transcript: string) => {
      if (!activeVideo || !canImportTranscript(activeVideo) || importingRef.current) return false;
      importingRef.current = true;
      setIsImportingTranscript(true);
      try {
        const response = await extractionApi.importTranscript({
          videoId: activeVideo.videoId,
          transcript,
          chapters: activeVideo.chapters ?? [],
          editableChapters: activeVideo.isEditableChapters,
        });
        if (useWorkspaceStore.getState().activeVideo?.videoId === response.videoId) {
          importedRevision.current += 1;
          useWorkspaceStore.getState().discardPendingAiDraft(response.videoId);
          replaceVideoResponse(response);
          onImported();
        }
        notify.success(
          "Transcript added",
          `${response.transcriptSegments.length.toLocaleString()} timestamped segments are ready.`,
        );
        // Browser storage must not keep a completed parse in its loading state.
        let saveDelayed = false;
        const saveTimer = window.setTimeout(() => {
          saveDelayed = true;
          notify.warning("Transcript saving is delayed", "Your transcript is ready to use. Keep this tab open while browser storage finishes saving.");
        }, 10_000);
        void Promise.resolve().then(() => saveTranscriptSource(response)).then(() => {
          window.clearTimeout(saveTimer);
          if (saveDelayed) notify.success("Transcript saved", "Your imported transcript is now saved in this browser.");
        }).catch(() => {
          window.clearTimeout(saveTimer);
          notify.warning("Transcript not saved", "Your transcript is ready to use, but browser storage could not save it. Keep a copy before closing or refreshing this tab.");
        });
        return true;
      } catch (error) {
        notifyApiError(
          error,
          "Transcript import failed",
          getUserFacingApiError(error, "Unable to parse the pasted transcript."),
        );
        return false;
      } finally {
        importingRef.current = false;
        setIsImportingTranscript(false);
      }
    },
    [activeVideo, replaceVideoResponse, onImported],
  );


  return { importTranscript, isImportingTranscript };
}
