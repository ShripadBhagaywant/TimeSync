import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkspaceStore } from "../store/workspaceStore";
import { deleteDraft, saveVideoWorkspace, saveTranscriptSource, applyWorkspaceDraft } from "@/lib/indexDB";
import { notify } from "@/lib/toast";
import { hasPlaylistSection, upsertPlaylistAiSection } from "../utils/playlistNoteDocument";
import { restoreOriginalDraft as restoreOriginalDraftSource } from "../utils/restoreOriginalDraft";

export const useWorkspaceDraftActions = (
  setLiveEditorHtml: Dispatch<SetStateAction<string>>,
  setEditorRevision: Dispatch<SetStateAction<number>>,
) => {
  const {
    activeVideo,
    playlistData,
    playlistNoteDocument,
    pendingAiDrafts,
    setPlaylistNoteDocument,
    replaceVideoResponse,
    discardPendingAiDraft,
  } = useWorkspaceStore(useShallow(state => ({
    activeVideo: state.activeVideo,
    playlistData: state.playlistData,
    playlistNoteDocument: state.playlistNoteDocument,
    pendingAiDrafts: state.pendingAiDrafts,
    setPlaylistNoteDocument: state.setPlaylistNoteDocument,
    replaceVideoResponse: state.replaceVideoResponse,
    discardPendingAiDraft: state.discardPendingAiDraft,
  })));
  const visiblePendingAiDraft = activeVideo ? pendingAiDrafts[activeVideo.videoId] ?? null : null;
  const activeVideoHasPlaylistSection = Boolean(activeVideo && hasPlaylistSection(playlistNoteDocument, activeVideo.videoId));
  const discardAiDraft = useCallback(async (videoId: string) => {
    const source = useWorkspaceStore.getState().activeVideo;
    if (!source || source.videoId !== videoId) return;
    try {
      await saveVideoWorkspace(source, null);
      discardPendingAiDraft(videoId);
      notify.info("AI draft discarded", "Your transcript and editor content are unchanged. You can create another draft, including in a different language.");
    } catch {
      notify.error("Draft not discarded", "Browser storage is unavailable. Please try again.");
    }
  }, [discardPendingAiDraft]);
  const applyAiDraft = useCallback(async () => {
    if (!visiblePendingAiDraft) return;
    const stillCurrent = () => {
      const state = useWorkspaceStore.getState();
      return state.activeVideo?.videoId === visiblePendingAiDraft.videoId
        && state.pendingAiDrafts[visiblePendingAiDraft.videoId] === visiblePendingAiDraft;
    };
    if (!stillCurrent()) return;
    if (playlistData && playlistNoteDocument) {
      const order = Math.max(
        0,
        playlistData.videoNotes.findIndex(
          (video) => video.videoId === visiblePendingAiDraft.videoId,
        ),
      );
      const nextDocument = upsertPlaylistAiSection(
        playlistNoteDocument,
        visiblePendingAiDraft,
        order,
      );
      try {
        if (!await applyWorkspaceDraft(visiblePendingAiDraft, stillCurrent, nextDocument, playlistNoteDocument.updatedAt)) return;
      } catch {
        notify.error("Draft not applied", "Browser storage could not save this draft. Please try again.");
        return;
      }
      if (!stillCurrent()
          || useWorkspaceStore.getState().playlistNoteDocument !== playlistNoteDocument) return;
      setPlaylistNoteDocument(nextDocument);
      replaceVideoResponse({ ...visiblePendingAiDraft, aiJobId: null });
      discardPendingAiDraft(visiblePendingAiDraft.videoId);
      setLiveEditorHtml(nextDocument.content);
      setEditorRevision((value) => value + 1);
      notify.success(
        activeVideoHasPlaylistSection
          ? "Playlist section updated"
          : "Added to playlist notes",
        `The draft for “${visiblePendingAiDraft.title}” is now in the master document. You can change the output language and create another draft.`,
      );
      return;
    }
    try {
      if (!await applyWorkspaceDraft(visiblePendingAiDraft, stillCurrent)) return;
    } catch {
      notify.error("Draft not applied", "Browser storage could not save this draft. Please try again.");
      return;
    }
    if (!stillCurrent()) return;
    replaceVideoResponse({ ...visiblePendingAiDraft, aiJobId: null });
    setEditorRevision((value) => value + 1);
    discardPendingAiDraft(visiblePendingAiDraft.videoId);
    notify.success(
      "AI draft applied",
      "The structured notes are now in the editor. You can change the output language and create another draft.",
    );
  }, [
    setEditorRevision,
    setLiveEditorHtml,
    activeVideoHasPlaylistSection,
    discardPendingAiDraft,
    playlistData,
    playlistNoteDocument,
    replaceVideoResponse,
    setPlaylistNoteDocument,
    visiblePendingAiDraft,
  ]);

  const restoreOriginalDraft = useCallback(async () => {
    if (!activeVideo) return;
    try {
      const restored = await restoreOriginalDraftSource(
        activeVideo.videoId,
        Boolean(playlistData),
        {
          deleteDraft,
          saveSource: saveTranscriptSource,
          isCurrent: () => useWorkspaceStore.getState().activeVideo?.videoId === activeVideo.videoId,
          replaceVideoResponse,
          discardPendingAiDraft,
          remountSingleVideoEditor: () => {
            setLiveEditorHtml("");
            setEditorRevision((value) => value + 1);
          },
        },
      );
      if (!restored) {
        notify.error(
          "Original draft unavailable",
          "The original source transcript could not be found for this video.",
        );
        return;
      }
      notify.success(
        "Original draft restored",
        playlistData ? "The source transcript is restored. Your playlist master document is unchanged." : "The timestamped source transcript is back in the editor.",
      );
    } catch (error) {
      notify.error(
        "Original draft unavailable",
        error instanceof Error
          ? error.message
          : "Unable to restore the original source transcript.",
      );
    }
  }, [activeVideo, discardPendingAiDraft, playlistData, replaceVideoResponse, setEditorRevision, setLiveEditorHtml]);

  return { applyAiDraft, restoreOriginalDraft, discardAiDraft };
};
