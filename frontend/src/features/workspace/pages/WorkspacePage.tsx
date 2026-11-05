import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { isContentBlocked } from "@/features/extraction/utils/contentPolicy";
import { getUserFacingApiError } from "@/features/extraction/utils/extractionErrors";
import { WorkspaceSourcePanel } from "../components/WorkspaceSourcePanel";
import { WorkspaceMobileNav } from "../components/WorkspaceMobileNav";
import { useWorkspaceRecovery } from "../hooks/useWorkspaceRecovery";
import { useWorkspaceSharing } from "../hooks/useWorkspaceSharing";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { TranscriptImportDialog } from "../components/transcript/TranscriptImportDialog";
import type { EditorDisplayMode } from "../components/editor/editorFormatting";
import { ExportModal } from "../components/export/ExportModal";
import { PlaylistSidebar } from "../components/playlist/PlaylistSidebar";
import { ShareNoteDialog } from "../components/share/ShareNoteDialog";
import { WorkspaceAiStatus } from "../components/WorkspaceAiStatus";
import { ShortcutsModal } from "../components/shortcuts/ShortcutsModal";
import { useAiRefinement } from "../hooks/useAiRefinement";
import { useWorkspaceDraftActions } from "../hooks/useWorkspaceDraftActions";
import { useWorkspaceStore } from "../store/workspaceStore";
import { useWorkspaceData } from "../hooks/useWorkspaceData";
import { useNavigate } from "react-router-dom";
import { SaveStatus } from "../hooks/useIndexedDBSave";
import { AlertCircle, Video } from "lucide-react";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useShallow } from "zustand/react/shallow";
import {
  hasPlaylistSection,
} from "../utils/playlistNoteDocument";

const NotesEditor = React.lazy(() =>
  import("../components/editor/NotesEditor").then((module) => ({
    default: module.NotesEditor,
  })),
);

export const WorkspacePage: React.FC = () => {
  const { isLoading, error, refetch } = useWorkspaceData();
  const navigate = useNavigate();

  const {
    activeVideo,
    playlistData,
    playlistNoteDocument,
    playlistDocumentHydrated,
    pendingAiDrafts,
    setActiveVideo,
    isPlaylistSidebarOpen,
    togglePlaylistSidebar,
    customTitle,
    autoSaveEnabled,
    resetWorkspace,
    updatePlaylistDocumentContent,
    isShortcutPanelOpen,
    setIsShortcutPanelOpen,
  } = useWorkspaceStore(
    useShallow((state) => ({
      activeVideo: state.activeVideo,
      playlistData: state.playlistData,
      playlistNoteDocument: state.playlistNoteDocument,
      playlistDocumentHydrated: state.playlistDocumentHydrated,
      pendingAiDrafts: state.pendingAiDrafts,
      setActiveVideo: state.setActiveVideo,
      isPlaylistSidebarOpen: state.isPlaylistSidebarOpen,
      togglePlaylistSidebar: state.togglePlaylistSidebar,
      customTitle: state.customTitle,
      autoSaveEnabled: state.autoSaveEnabled,
      resetWorkspace: state.resetWorkspace,
      updatePlaylistDocumentContent: state.updatePlaylistDocumentContent,
      isShortcutPanelOpen: state.isShortcutPanelOpen,
      setIsShortcutPanelOpen: state.setIsShortcutPanelOpen,
    })),
  );

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isHomeConfirmOpen, setIsHomeConfirmOpen] = useState(false);
  const [liveEditorHtml, setLiveEditorHtml] = useState("");
  const [editorRevision, setEditorRevision] = useState(0);
  const [isTranscriptDialogOpen, setIsTranscriptDialogOpen] = useState(false);
  const { isStartingAi, targetLanguage, setTargetLanguage, aiRetryKey, startAiRefinement } = useAiRefinement(setIsTranscriptDialogOpen);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [leftTab, setLeftTab] = useState<"transcript" | "info" | "chapters">(
    "transcript",
  );
  const [mobileTab, setMobileTab] = useState<"left" | "right">("left");
  const [editorDisplayMode, setEditorDisplayMode] =
    useState<EditorDisplayMode>("normal");

  const editorRef = useRef<HTMLDivElement | null>(null);
  const currentTitle =
    playlistNoteDocument?.title ||
    customTitle ||
    activeVideo?.title ||
    "Untitled Workspace";
  const workspaceType = playlistData ? "playlist" : "single";
  const homeConfirmDescription = !autoSaveEnabled
    ? "Auto-save is off, so recent edits may not be saved. Going home does not delete an existing draft; use Clear Draft in the editor first if you want to remove it."
    : saveStatus === "saved"
      ? "Your latest draft is saved on this device. Going home keeps it; it does not clear or delete it. Use Clear Draft in the editor if you want to remove it first."
      : saveStatus === "saving"
        ? "Your draft is still saving. Wait for Saved locally before leaving to keep your latest edits. Going home does not clear the saved draft."
        : saveStatus === "error"
          ? "The latest edits could not be saved. Going home may lose those edits, but it does not delete an earlier saved draft."
          : "Going home does not clear your draft. It remains on this device if saved. Use Clear Draft in the editor first if you want to remove it.";
  const visiblePendingAiDraft = activeVideo?.videoId
    ? (pendingAiDrafts[activeVideo.videoId] ?? null)
    : null;
  const activeVideoHasPlaylistSection = Boolean(
    activeVideo &&
    hasPlaylistSection(playlistNoteDocument, activeVideo.videoId),
  );
  useEffect(() => { document.documentElement.style.colorScheme = "light"; }, []);
  useEffect(() => {
    if (!isShortcutPanelOpen) return;
    setEditorDisplayMode("normal");
    setMobileTab("right");
  }, [isShortcutPanelOpen]);
  const onTranscriptImported = useCallback(() => {
    setIsTranscriptDialogOpen(false);
    setLeftTab("transcript");
    setEditorDisplayMode("normal");
    setMobileTab("right");
  }, []);
  const { importTranscript, isImportingTranscript } = useWorkspaceRecovery(onTranscriptImported, setEditorRevision, isLoading);
  const { isSharing, shareUrl, closeShareDialog, handleSnapshot, handleShareWorkspace } = useWorkspaceSharing({
    activeVideo, currentTitle, content: playlistNoteDocument?.content || liveEditorHtml, editorRef,
  });
  const { applyAiDraft, restoreOriginalDraft, discardAiDraft: discardPendingAiDraft } = useWorkspaceDraftActions(setLiveEditorHtml, setEditorRevision);

  const handleEditorRef = useCallback((node: HTMLDivElement | null) => {
    editorRef.current = node;
  }, []);

  const handleEditorContentChange = useCallback(
    (html: string) => {
      setLiveEditorHtml(html);
      if (useWorkspaceStore.getState().playlistNoteDocument) {
        updatePlaylistDocumentContent(html);
      }
    },
    [updatePlaylistDocumentContent],
  );

  const handleEditorDisplayModeChange = useCallback(
    (mode: EditorDisplayMode) => {
      setEditorDisplayMode(mode);
      if (mode === "minimized") setMobileTab("left");
      if (mode !== "minimized") setMobileTab("right");
    },
    [],
  );

  if (isLoading && !activeVideo) {
    return (
      <BrandLoader variant="page" size="lg" title="Loading workspace" message="Preparing your video notes and transcript…" />
    );
  }

  if (isContentBlocked(activeVideo) || error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
          <h2 className="text-lg font-bold text-slate-900">
            Workspace unavailable
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {isContentBlocked(activeVideo)
              ? "This content is not eligible for educational or informational notes."
              : getUserFacingApiError(error, "The selected video or playlist could not be loaded.")}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Back home
            </button>
            <button
              onClick={() => refetch()}
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeVideo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <Video className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900">
            No workspace loaded
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Paste a YouTube video or playlist link to start a new notes session.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            Go to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden relative bg-slate-100/70 text-slate-900">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <WorkspaceHeader key={playlistData?.playlistId || activeVideo.videoId} currentTitle={currentTitle} saveStatus={saveStatus}
          isSharing={isSharing} handleSnapshot={handleSnapshot} handleShareWorkspace={handleShareWorkspace}
          editorDisplayMode={editorDisplayMode} onEditorDisplayModeChange={handleEditorDisplayModeChange}
          onExport={() => setIsExportOpen(true)} onHome={() => setIsHomeConfirmOpen(true)} />
        <WorkspaceMobileNav mobileTab={mobileTab} setMobileTab={(tab) => {
          if ((tab === "left" && editorDisplayMode === "maximized") ||
              (tab === "right" && editorDisplayMode === "minimized")) {
            handleEditorDisplayModeChange("normal");
          }
          setMobileTab(tab);
        }} />
        <div className="flex min-h-0 flex-1 overflow-hidden p-1.5 sm:p-2.5 md:p-3 gap-2 md:gap-3 relative bg-slate-100/70">
          {playlistData && (
            <PlaylistSidebar
              playlist={playlistData}
              activeVideoId={activeVideo?.videoId}
              isOpen={isPlaylistSidebarOpen}
              onClose={togglePlaylistSidebar}
              onSelectVideo={(videoId) => {
                const nextVid = playlistData.videoNotes.find(
                  (v) => v.videoId === videoId,
                );
                if (!nextVid) return;
                setActiveVideo(nextVid);
                navigate(
                  `/workspace/playlist/${playlistData.playlistId}/video/${videoId}`,
                  { state: { playlistData } },
                );
              }}
            />
          )}
          <div
            className={`${editorDisplayMode === "minimized" ? "w-full" : "w-full lg:w-[48%] xl:w-[35%]"} workspace-source-column min-h-0 min-w-0 overflow-hidden h-full gap-2 ${editorDisplayMode === "maximized" ? "hidden" : mobileTab === "left" ? "flex flex-col" : "hidden lg:flex lg:flex-col"}`}
          >
            <WorkspaceSourcePanel videoId={activeVideo.videoId} leftTab={leftTab} setLeftTab={setLeftTab} onImportTranscript={() => setIsTranscriptDialogOpen(true)} />
          </div>
          <div
            className={`${
              editorDisplayMode === "minimized"
                ? "hidden"
                : `flex-1 min-w-0 h-full ${mobileTab === "right" ? "flex flex-col" : "hidden lg:flex lg:flex-col"}`
            } shadow-xs rounded-2xl overflow-hidden`}
          >
            <WorkspaceAiStatus {...{ activeVideo, playlistData, visiblePendingAiDraft, editorDisplayMode, targetLanguage, setTargetLanguage, isStartingAi, aiRetryKey, activeVideoHasPlaylistSection, startAiRefinement, applyAiDraft, restoreOriginalDraft, discardPendingAiDraft }} />
            {playlistData && !playlistDocumentHydrated ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
                <BrandLoader size="xs" className="mr-2" />
                Restoring playlist notes…
              </div>
            ) : (
              <React.Suspense fallback={<div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-white text-sm text-slate-500"><BrandLoader size="xs" className="mr-2" />Opening notes editor…</div>}>
                <NotesEditor
                  key={`${playlistData ? `playlist-${playlistData.playlistId}` : `video-${activeVideo.videoId}`}-${editorRevision}`}
                  editorRef={handleEditorRef}
                  onContentChange={handleEditorContentChange}
                  onSaveStatusChange={setSaveStatus}
                  displayMode={editorDisplayMode}
                  onDisplayModeChange={handleEditorDisplayModeChange}
                />
              </React.Suspense>
            )}
          </div>
        </div>
      </div>

      <TranscriptImportDialog
        isOpen={isTranscriptDialogOpen}
        isSubmitting={isImportingTranscript}
        onClose={() => setIsTranscriptDialogOpen(false)}
        onSubmit={importTranscript}
      />

      <ShortcutsModal
        isOpen={isShortcutPanelOpen}
        onClose={() => setIsShortcutPanelOpen(false)}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        documentTitle={currentTitle}
        editorHtmlContent={liveEditorHtml}
        workspaceType={workspaceType}
        videoCount={playlistData?.videoNotes.length ?? 0}
      />

      <ConfirmDialog
        isOpen={isHomeConfirmOpen}
        title="Leave this workspace?"
        description={homeConfirmDescription}
        confirmText="Go home"
        cancelText="Stay in workspace"
        variant="warning"
        onConfirm={() => {
          setIsHomeConfirmOpen(false);
          resetWorkspace();
          navigate("/");
        }}
        onCancel={() => setIsHomeConfirmOpen(false)}
      />

      <ShareNoteDialog
        isOpen={Boolean(shareUrl)}
        shareUrl={shareUrl}
        onClose={closeShareDialog}
      />
    </div>
  );
};
