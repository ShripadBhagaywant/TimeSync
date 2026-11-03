// src/features/workspace/components/chapters/ChaptersDrawer.tsx
import React, { useState } from "react";
import {
  Search,
  Plus,
  X,
  Trash2,
  ListTree,
  Minus,
  Lock,
} from "lucide-react";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { ChapterDto } from "@/features/extraction/types/extraction.types";
import { getChapterDisplay } from "../../utils/chapterDisplay";
import { AddChapterDialog } from "./AddChapterDialog";
import { useShallow } from "zustand/react/shallow";

interface ChaptersDrawerProps {
  onClose?: () => void;
}

export const ChaptersDrawer: React.FC<ChaptersDrawerProps> = ({ onClose }) => {
  const { activeVideo, customChapters, currentTime, requestSeekTo, setEditableChapters } =
    useWorkspaceStore(useShallow((state) => ({
      activeVideo: state.activeVideo,
      customChapters: state.activeVideo ? state.videoPreferences[state.activeVideo.videoId]?.customChapters : undefined,
      currentTime: state.currentTime,
      requestSeekTo: state.requestSeekTo,
      setEditableChapters: state.setEditableChapters,
    })));

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const { chapters, source: displaySource } = getChapterDisplay(activeVideo, customChapters);
  const nativeUnavailable = activeVideo?.chapterAvailability === "TEMPORARILY_UNAVAILABLE";
  const chaptersTemporarilyUnavailable = nativeUnavailable && displaySource === "NONE";

  // Logic: Only allowed to edit if the backend explicitly says it's editable.
  // We default to false to ensure the UI is "Locked" by default.
  const isUserAllowedToEdit = !!activeVideo?.isEditableChapters;
  const canEditDisplayedChapters = isUserAllowedToEdit && displaySource === "CUSTOM";

  const filtered = chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter }) =>
      (chapter.title || "")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    );

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleSaveChapter = (title: string) => {
    if (!activeVideo) return;

    const newChapter: ChapterDto = {
      title,
      startTimestampSeconds: Math.floor(currentTime),
      formattedTimestamp: formatSeconds(currentTime),
    };

    const updatedChapters = [...(customChapters ?? []), newChapter].sort(
      (a, b) => a.startTimestampSeconds - b.startTimestampSeconds,
    );

    setEditableChapters(updatedChapters);
  };

  const handleRemoveChapter = (indexToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeVideo || !canEditDisplayedChapters) return;

    const updatedChapters = (customChapters ?? []).filter((_, idx) => idx !== indexToRemove);
    setEditableChapters(updatedChapters);

    if (updatedChapters.length === 0) setIsEditMode(false);
  };

  return (
    <>
      <aside className="w-full min-w-0 min-h-0 h-full bg-white flex flex-col select-none overflow-hidden relative">
        <div className="chapter-toolbar p-2.5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <div className="chapter-search relative min-w-0 flex-1 flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
            <input
              type="text"
              aria-label="Search chapters"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chapters..."
              className="min-h-11 min-w-0 w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-base sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-1 px-1 text-slate-400 shrink-0">
            <ListTree className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold">{chapters.length}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isUserAllowedToEdit ? (
              <>
                <button
                  aria-label="Edit chapters"
                  onClick={() => setIsEditMode(!isEditMode)}
                  disabled={!canEditDisplayedChapters}
                  aria-pressed={isEditMode}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border ${
                    !canEditDisplayedChapters ? "opacity-30 cursor-not-allowed" : ""
                  } ${isEditMode ? "bg-red-50 text-red-600 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  aria-label="Add chapter"
                  onClick={() => setIsDialogOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center bg-blue-50 text-blue-600 border border-blue-200 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                <Lock className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400">
                  Locked
                </span>
              </div>
            )}

            {onClose && (
              <>
                <div className="w-px h-5 bg-slate-200 mx-0.5" />
                <button onClick={onClose} aria-label="Close chapters" className="inline-flex h-11 w-11 items-center justify-center text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 space-y-1 font-medium">
          {displaySource === "CUSTOM" && (
            <p className="px-2 py-1 text-xs text-slate-400">
              {nativeUnavailable
                ? "Native chapters temporarily unavailable. Showing your saved chapter markers."
                : "Showing your saved chapter markers."}
            </p>
          )}
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-slate-400">
              <ListTree className="w-8 h-8 opacity-20 mx-auto mb-2" />
              <p className="text-xs">
                {chaptersTemporarilyUnavailable
                  ? "Chapters temporarily unavailable"
                  : chapters.length === 0 ? "No chapters found." : "No matching chapters."}
              </p>
              {chaptersTemporarilyUnavailable && (
                <p className="mt-1 text-xs">TimeSync couldn't retrieve chapter data right now.</p>
              )}
              {chapters.length === 0 && isUserAllowedToEdit && (
                <p className="mt-1 text-xs">Play the video and add your own chapter markers.</p>
              )}
            </div>
          ) : (
            filtered.map(({ chapter: ch, index }) => {
              const nextCh = chapters[index + 1];
              const isActive =
                currentTime >= ch.startTimestampSeconds &&
                (!nextCh || currentTime < nextCh.startTimestampSeconds);

              return (
                <div
                  key={`${ch.startTimestampSeconds}-${ch.title}`}
                  className={`flex min-w-0 items-center justify-between rounded-xl text-sm ${
                    isActive && !(isEditMode && canEditDisplayedChapters)
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <button type="button" disabled={isEditMode && canEditDisplayedChapters}
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => requestSeekTo(ch.startTimestampSeconds)}
                    className="flex min-h-12 min-w-0 flex-1 items-start gap-2 rounded-xl p-3 text-left">
                    <span className="shrink-0 bg-slate-100 px-1.5 py-0.5 rounded tabular-nums text-xs">
                      {ch.formattedTimestamp}
                    </span>
                    <span className="min-w-0 break-words leading-5 [overflow-wrap:anywhere]">{ch.title}</span>
                  </button>
                  {canEditDisplayedChapters && isEditMode && (
                    <button
                      aria-label={`Remove chapter ${ch.title}`}
                      onClick={(e) => handleRemoveChapter(index, e)}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {isUserAllowedToEdit && (
        <AddChapterDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleSaveChapter}
          currentTimeFormatted={formatSeconds(currentTime)}
        />
      )}
    </>
  );
};
