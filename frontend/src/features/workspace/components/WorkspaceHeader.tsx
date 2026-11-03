import type { EditorDisplayMode } from "./editor/editorFormatting";
import { useState } from "react";
import { CheckCircle2, AlertCircle, Share2, Download, Settings, Star, Edit3, ListVideo, Camera } from "lucide-react";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { useShallow } from "zustand/react/shallow";
import { useWorkspaceStore } from "../store/workspaceStore";
import type { SaveStatus } from "../hooks/useIndexedDBSave";
import { notify } from "@/lib/toast";
import { WorkspaceSettings } from "./WorkspaceSettings";

interface Props {
  editorDisplayMode?: EditorDisplayMode;
  onEditorDisplayModeChange?: (mode: EditorDisplayMode) => void;
  currentTitle: string;
  saveStatus: SaveStatus;
  isSharing: boolean;
  handleSnapshot: () => void;
  handleShareWorkspace: () => void;
  onExport: () => void;
  onHome: () => void;
}
export function WorkspaceHeader({ currentTitle, saveStatus: currentSaveStatus, isSharing, handleSnapshot, handleShareWorkspace, onExport, onHome, editorDisplayMode = "normal", onEditorDisplayModeChange }: Props) {
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isStarred, toggleStarred, setCustomTitle, autoSaveEnabled, playlistData, togglePlaylistSidebar } = useWorkspaceStore(useShallow(state => ({
    isStarred: state.isStarred, toggleStarred: state.toggleStarred, setCustomTitle: state.setCustomTitle,
    autoSaveEnabled: state.autoSaveEnabled, playlistData: state.playlistData, togglePlaylistSidebar: state.togglePlaylistSidebar,
  })));
  const saveStatus = autoSaveEnabled ? currentSaveStatus : "idle";
  const handleSaveTitle = () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      notify.error("Title required", "Workspace title cannot be empty.");
      return;
    }
    const state = useWorkspaceStore.getState();
    if (state.playlistNoteDocument) {
      state.setPlaylistNoteDocument({ ...state.playlistNoteDocument, title: nextTitle, updatedAt: Date.now() });
    } else setCustomTitle(nextTitle);
    setIsTitleEditing(false);
    notify.success("Title updated", "Workspace title updated.");
  };


  const toggleStar = () => {
    const nextValue = !isStarred;
    toggleStarred();
    notify.success(
      nextValue ? "Added to Favorites" : "Removed from Favorites",
      nextValue
        ? "Workspace starred for quick access."
        : "Workspace unstarred.",
    );
  };


  return <>
        <header className="mx-2 mt-2 flex min-h-14 shrink-0 flex-col items-stretch gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-xs sm:flex-row sm:items-center sm:gap-3 sm:px-3 md:mx-3 md:px-4 lg:mx-4 lg:px-5">
          <div className="flex min-w-0 items-center gap-1.5 sm:flex-1 sm:gap-2">
            {isTitleEditing ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                <input
                  aria-label="Workspace title"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") setIsTitleEditing(false);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-400 focus:bg-white sm:max-w-xs"
                  autoFocus
                />
                <button
                  onClick={handleSaveTitle}
                  className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsTitleEditing(false)}
                  className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <h1 className="min-w-0 max-w-[calc(100%-4.5rem)] truncate text-xs font-bold text-slate-900 sm:max-w-[14rem] sm:text-sm md:max-w-xs lg:max-w-sm lg:text-base">
                  {currentTitle}
                </h1>
                <button
                  onClick={toggleStar}
                  className="p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 text-slate-400 hover:text-amber-400 hover:bg-slate-50"
                  aria-pressed={isStarred}
                  title={isStarred ? "Unstar Workspace" : "Star Workspace"}
                >
                  <Star
                    className={`w-4 h-4 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`}
                  />
                </button>
                <button
                  onClick={() => {
                    setTitleDraft(currentTitle);
                    setIsTitleEditing(true);
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                  title="Edit title"
                  aria-label="Edit workspace title"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              aria-label="Workspace settings"
              title="Workspace settings"
              aria-expanded={isSettingsOpen}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <div className="flex w-full min-w-0 shrink-0 items-center justify-start gap-1 overflow-x-auto border-t border-slate-100 pt-2 [scrollbar-width:none] sm:w-auto sm:max-w-[58%] sm:gap-1.5 sm:border-t-0 sm:pt-0 md:max-w-[64%] lg:max-w-none">
            <div role="status" className="flex items-center text-xs font-medium">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 text-amber-600">
                  <BrandLoader size="xs" />
                  <span className="hidden lg:inline">Saving...</span>
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Saved locally</span>
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Save failed</span>
                </span>
              )}
              {saveStatus === "idle" && (
                <span className="flex items-center gap-1 text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden lg:inline">{autoSaveEnabled ? "Ready to save" : "Auto-save off"}</span>
                </span>
              )}
            </div>

            <div className="mx-1 h-4 w-px shrink-0 bg-slate-200" />

            {playlistData && (
              <button
                onClick={togglePlaylistSidebar}
                className="px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-xs rounded-xl border border-red-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ListVideo className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">
                  Playlist ({playlistData.processedVideos})
                </span>
              </button>
            )}

            <button
              onClick={handleSnapshot}
              disabled={isSharing}
              aria-label={
                isSharing ? "Creating snapshot link" : "Create snapshot link"
              }
              title="Create a read-only snapshot"
              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60 font-semibold text-xs rounded-xl border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isSharing ? (
                <BrandLoader size="xs" tone="inverse" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              {isSharing ? "Creating link" : "Snapshot"}
            </button>

            <button
              onClick={handleShareWorkspace}
              className="px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold text-xs rounded-xl border border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Copy the current workspace route"
            >
              <Share2 className="w-3.5 h-3.5" />
              Workspace
            </button>

            <button
              onClick={onExport}
              aria-label="Export notes"
              title="Export notes"
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>

            
          </div>
        </header>


    <WorkspaceSettings editorDisplayMode={editorDisplayMode} onEditorDisplayModeChange={onEditorDisplayModeChange} isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onHome={() => { setIsSettingsOpen(false); onHome(); }} />
  </>;
}
