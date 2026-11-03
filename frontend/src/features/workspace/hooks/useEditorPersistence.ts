import { isMetadataWorkspace } from "@/features/extraction/utils/transcriptEvidence";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useWorkspaceStore } from "../store/workspaceStore";
import { useIndexedDBSave, type SaveStatus } from "./useIndexedDBSave";
import { usePlaylistDocumentSave } from "./usePlaylistDocumentSave";
import { getDraft, saveDraft, saveVideoWorkspace, deletePlaylistNoteDocument } from "@/lib/indexDB";
import { markdownToEditorHtml } from "../utils/markdownToEditorHtml";
import { notify } from "@/lib/toast";

export const useEditorPersistence = (
  editor: Editor | null,
  onContentChange?: (html: string) => void,
  onSaveStatusChange?: (status: SaveStatus) => void,
) => {
  const activeVideo = useWorkspaceStore((state) => state.activeVideo);
  const autoSaveEnabled = useWorkspaceStore((state) => state.autoSaveEnabled);
  const playlistDocument = useWorkspaceStore((state) => state.playlistNoteDocument);
  const playlistDocumentHydrated = useWorkspaceStore((state) => state.playlistDocumentHydrated);
  const discardPendingAiDraft = useWorkspaceStore((state) => state.discardPendingAiDraft);
  const hasPendingAiDraft = useWorkspaceStore((state) => Boolean(
    state.activeVideo?.videoId && state.pendingAiDrafts[state.activeVideo.videoId],
  ));

  const videoId = activeVideo?.videoId || "";
  const videoTitle = activeVideo?.title || "Untitled Note";
  const documentId = playlistDocument
    ? `playlist:${playlistDocument.playlistId}`
    : `video:${videoId}`;

  const [editorContent, setEditorContent] = useState<string>("");
  const [hydratedVideoId, setHydratedVideoId] = useState<string | null>(null);
  const [clearedVideoId, setClearedVideoId] = useState<string | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const isClearingRef = useRef(false);
  const clearedVideoIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      const html = editor.getHTML();
      setEditorContent(html);
      if (!isClearingRef.current && clearedVideoIdRef.current) {
        clearedVideoIdRef.current = null;
        setClearedVideoId(null);
      }
      onContentChange?.(html);
    };
    editor.on("update", onUpdate);
    return () => { editor.off("update", onUpdate); };
  }, [editor, onContentChange]);

  // Preserve & Hydrate Drafts: Priority: Existing Local Draft > Server Content > Blank
  useEffect(() => {
    let isMounted = true;

    const hydrateContent = async () => {
      if (!documentId || !editor) return;
      if (loadedVideoIdRef.current === documentId) return;

      try {
        const savedDraft = playlistDocument ? null : await getDraft(videoId).catch(() => {
          console.warn("Local editor draft unavailable; using workspace content.");
          return undefined;
        });

        if (!isMounted) return;

        // Load existing saved draft if present (Preserves unsaved user edits)
        if (playlistDocument) {
          editor.commands.setContent(playlistDocument.content || "<p></p>");
          setEditorContent(playlistDocument.content);
          onContentChange?.(playlistDocument.content);
        } else if (savedDraft) {
          // An empty saved draft is an intentional clear marker; don't repopulate
          // the editor from transcript content after a refresh.
          const savedContent = savedDraft.content || "";
          editor.commands.setContent(savedContent || "<p></p>");
          setEditorContent(savedContent);
          onContentChange?.(savedContent);
        } else if (activeVideo?.cleanedTranscript || activeVideo?.content) {
          const initialContent =
            activeVideo.cleanedTranscript || activeVideo.content;
          const formattedHtml = markdownToEditorHtml(initialContent);

          editor.commands.setContent(formattedHtml);
          setEditorContent(formattedHtml);
          onContentChange?.(formattedHtml);
        } else {
          editor.commands.setContent("<p></p>");
          setEditorContent("");
          onContentChange?.("");
        }

        loadedVideoIdRef.current = documentId;
        setHydratedVideoId(videoId);
      } catch (err) {
        console.error("IndexedDB Hydration Error:", err);
      }
    };

    hydrateContent();

    return () => {
      isMounted = false;
    };
  }, [
    documentId,
    editor,
    activeVideo?.content,
    activeVideo?.cleanedTranscript,
    playlistDocument,
    onContentChange,
    videoId,
  ]);

  // Debounced Save Hook
  const currentHtmlToSave = editor ? editor.getHTML() : editorContent;
  const { saveStatus } = useIndexedDBSave(
    videoId,
    videoTitle,
    currentHtmlToSave,
    600,
    undefined,
    !playlistDocument &&
    autoSaveEnabled &&
    hydratedVideoId === videoId &&
    clearedVideoId !== documentId &&
    (!isMetadataWorkspace(activeVideo) || Boolean(editor && !editor.isEmpty)),
  );
  const { saveStatus: playlistSaveStatus } = usePlaylistDocumentSave(
    playlistDocument,
    autoSaveEnabled &&
    playlistDocumentHydrated &&
    clearedVideoId !== documentId,
  );
  const effectiveSaveStatus = playlistDocument ? playlistSaveStatus : saveStatus;

  // Notify parent component of save status updates
  useEffect(() => {
    if (onSaveStatusChange) {
      onSaveStatusChange(effectiveSaveStatus);
    }
  }, [effectiveSaveStatus, onSaveStatusChange]);

  // Manual draft deletion when user explicitly confirms
  const handleConfirmClearDraft = useCallback(async () => {
    if (!editor) return;

    // Clearing is a deletion, not an edit: keep autosave disabled until the
    // user makes their next change so an empty draft is not recreated.
    clearedVideoIdRef.current = documentId;
    setClearedVideoId(documentId);
    isClearingRef.current = true;
    editor.commands.clearContent();
    isClearingRef.current = false;
    setEditorContent("");

    try {
      if (playlistDocument) {
        await deletePlaylistNoteDocument(playlistDocument.playlistId);
        useWorkspaceStore.getState().updatePlaylistDocumentContent("");
      } else {
        // Keep a blank tombstone so refresh doesn't restore transcript content
        // into the editor after the user explicitly cleared the draft.
        await saveDraft({ videoId, videoTitle, content: "", updatedAt: Date.now() });
      }
      if (activeVideo) await saveVideoWorkspace(activeVideo, null);
      if (activeVideo) discardPendingAiDraft(activeVideo.videoId);
      // Reset loaded ref so fresh content can reload if needed
      loadedVideoIdRef.current = null;
      notify.success("Draft Cleared", "Your notes are cleared and will stay cleared after refresh. The source transcript is kept.");
    } catch (err) {
      console.error("Failed to clear IndexedDB draft:", err);
      notify.error("Draft not cleared", "Browser storage could not save the change. Please try again.");
    }
  }, [activeVideo, discardPendingAiDraft, documentId, editor, playlistDocument, videoId, videoTitle]);

  return {
    clearDraft: handleConfirmClearDraft,
    saveStatus: effectiveSaveStatus,
    isHydrated: playlistDocument ? playlistDocumentHydrated : hydratedVideoId === videoId,
    isPlaylistDocument: Boolean(playlistDocument),
    hasPendingAiDraft,
  };
};
