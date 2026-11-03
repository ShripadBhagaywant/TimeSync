import React, { useEffect, useRef } from "react";
import { getPreparationLabel } from "../../utils/notePresentation";
import { ListVideo, X, Play } from "lucide-react";
import { PlaylistTranscriptResponse } from "@/features/extraction/types/extraction.types";
import { useDialogFocus } from "@/components/ui/useDialogFocus";

interface PlaylistSidebarProps {
  playlist: PlaylistTranscriptResponse;
  activeVideoId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (videoId: string) => void;
}

export const PlaylistSidebar: React.FC<PlaylistSidebarProps> = ({
  playlist,
  activeVideoId,
  isOpen,
  onClose,
  onSelectVideo,
}) => {
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const panelRef = useDialogFocus(isOpen, onClose);
  useEffect(() => {
    if (isOpen) activeItemRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [isOpen, activeVideoId]);

  const videos = playlist.videoNotes;
  const currentIndex = videos.findIndex((video) => video.videoId === activeVideoId);
  const activeVideoNumber = currentIndex >= 0 ? currentIndex + 1 : 1;
  const transcriptCount = playlist.captionVideos ?? videos.filter((video) => video.noteSource === "CAPTIONS").length;
  const metadataCount = playlist.metadataVideos ?? videos.filter((video) => video.noteSource === "METADATA").length;
  const progress = videos.length ? Math.min(100, (activeVideoNumber / videos.length) * 100) : 0;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose} aria-hidden="true" />
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="playlist-panel-title" tabIndex={-1}
        className="ux-dialog absolute left-3 top-1 z-50 flex max-h-[82vh] w-[calc(100vw-1.5rem)] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-15px_rgba(15,23,42,0.3)] animate-in slide-in-from-left duration-200">
        <header className="shrink-0 border-b border-slate-100 bg-slate-800 p-4 text-white">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
                <ListVideo aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-300">Course playlist</span>
            </div>
            <button type="button" onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Close playlist panel">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <h2 id="playlist-panel-title" className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-white">{playlist.playlistTitle}</h2>
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-300">
            <span>Video {activeVideoNumber} of {videos.length}</span>
            <span>{playlist.totalVideos} total</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold">
            <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-emerald-200">{transcriptCount} with transcript</span>
            {metadataCount > 0 && <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-amber-200">{metadataCount} need transcript</span>}
          </div>

          {(playlist.failedVideos > 0 || playlist.truncated || playlist.stoppedEarly) && (
            <p role="status" className="mt-3 rounded-lg bg-amber-400/10 px-2.5 py-2 text-[10px] leading-relaxed text-amber-200">
              {playlist.failedVideos > 0 && playlist.failedVideos + " videos could not be processed. "}
              {playlist.stoppedEarly && playlist.skippedVideos + " were skipped to avoid repeated rate limits. "}
              {playlist.truncated && "This run was limited to " + playlist.maxVideos + " videos."}
            </p>
          )}

          {videos.length > 0 && (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-700" role="progressbar"
              aria-label="Playlist position" aria-valuemin={1} aria-valuemax={videos.length} aria-valuenow={activeVideoNumber}>
              <div className="h-full rounded-full bg-red-500 transition-[width] duration-300" style={{ width: String(progress) + "%" }} />
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" aria-label="Playlist videos">
          {videos.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <ListVideo aria-hidden="true" className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">No videos available</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">This playlist did not return any processed videos.</p>
            </div>
          ) : videos.map((video, index) => {
            const isActive = video.videoId === activeVideoId;
            return (
              <button ref={isActive ? activeItemRef : undefined} aria-current={isActive ? "true" : undefined}
                key={video.videoId} type="button"
                onClick={() => { if (!isActive) onSelectVideo(video.videoId); onClose(); }}
                className={"group relative flex min-h-[76px] w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 " +
                  (isActive ? "border-red-200 bg-red-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50")}>
                <span className={"w-5 shrink-0 text-center text-xs font-semibold " + (isActive ? "text-red-600" : "text-slate-400")}>{index + 1}</span>
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async"
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No preview</div>
                  )}
                  {isActive && <span className="absolute inset-0 flex items-center justify-center bg-slate-950/45">
                    <Play aria-label="Now playing" className="h-4 w-4 animate-pulse fill-white text-white" />
                  </span>}
                  {video.duration && <span className="absolute bottom-1 right-1 rounded bg-slate-950/85 px-1.5 py-0.5 text-[9px] font-medium text-white">{video.duration}</span>}
                </div>

                <span className="min-w-0 flex-1 pr-1">
                  <span className={"line-clamp-2 block text-xs leading-snug " + (isActive ? "font-semibold text-red-950" : "font-medium text-slate-700 group-hover:text-slate-950")}>{video.title}</span>
                  <span className="mt-1.5 flex min-w-0 items-center gap-1.5">
                    {video.channelName && <span className="max-w-[100px] truncate text-[10px] text-slate-500">{video.channelName}</span>}
                    {video.cleaningStage && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{getPreparationLabel(video.cleaningStage)}</span>}
                    <span className={"shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold " +
                      (video.noteSource === "METADATA" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                      {video.noteSource === "METADATA" ? "Metadata" : "Transcript"}
                    </span>
                  </span>
                </span>
                {isActive && <span aria-hidden="true" className="absolute right-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-red-600" />}
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
};
