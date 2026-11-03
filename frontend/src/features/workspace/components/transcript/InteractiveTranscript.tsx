import { isMetadataWorkspace } from "@/features/extraction/utils/transcriptEvidence";
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardPaste, LocateFixed, Search } from "lucide-react";
import { TranscriptSegment } from "@/features/extraction/types/extraction.types";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useShallow } from "zustand/react/shallow";

interface InteractiveTranscriptProps {
  onPasteTranscript: () => void;
}

const ROW_HEIGHT = 56;
const OVERSCAN_ROWS = 7;

export const InteractiveTranscript: React.FC<InteractiveTranscriptProps> = ({ onPasteTranscript }) => {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { metadataOnly, transcriptSegments, transcriptContent, currentTime, requestSeekTo, showTranscriptTimestamps } = useWorkspaceStore(
    useShallow((state) => ({
      metadataOnly: isMetadataWorkspace(state.activeVideo),
      transcriptSegments: state.activeVideo?.transcriptSegments,
      transcriptContent: state.activeVideo?.content,
      currentTime: state.currentTime,
      requestSeekTo: state.requestSeekTo,
      showTranscriptTimestamps: state.showTranscriptTimestamps,
    })),
  );

  const segments = useMemo<TranscriptSegment[]>(() => {
    const timedSegments = transcriptSegments ?? [];
    return timedSegments.length > 0
      ? timedSegments.filter((segment) => segment.text.trim().length > 0)
      : transcriptContent?.trim()
        ? [{ startSeconds: 0, durationSeconds: 0, text: transcriptContent.trim() }]
        : [];
  }, [transcriptContent, transcriptSegments]);

  const visibleSegments = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
    return normalizedQuery
      ? segments.filter((segment) => segment.text.toLocaleLowerCase().includes(normalizedQuery))
      : segments;
  }, [deferredQuery, segments]);

  const activeSegmentIndex = useMemo(() => {
    let low = 0;
    let high = segments.length - 1;
    let result = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const middleSegment = segments[middle];
      if (middleSegment && middleSegment.startSeconds <= currentTime) {
        result = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return result;
  }, [currentTime, segments]);
  const activeSegment = activeSegmentIndex >= 0 ? segments[activeSegmentIndex] : null;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const endIndex = Math.min(
    visibleSegments.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS,
  );
  const windowedSegments = visibleSegments.slice(startIndex, endIndex);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      setViewportHeight(entries[0]?.contentRect.height ?? 480);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [segments.length]);

  const formatSeconds = (seconds: number) => {
    const normalized = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(normalized / 3600);
    const minutes = Math.floor((normalized % 3600) / 60);
    const secs = normalized % 60;
    return hours > 0
      ? [hours, minutes, secs].map((value) => value.toString().padStart(2, "0")).join(":")
      : [minutes, secs].map((value) => value.toString().padStart(2, "0")).join(":");
  };

  const locateCurrentSegment = () => {
    if (!activeSegment) return;
    const visibleIndex = visibleSegments.indexOf(activeSegment);
    if (visibleIndex < 0) return;
    scrollRef.current?.scrollTo({
      top: Math.max(0, visibleIndex * ROW_HEIGHT - viewportHeight / 3),
      behavior: "smooth",
    });
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    setScrollTop(0);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-white text-xs text-slate-700">
      {segments.length === 0 ? (
        <div className="flex h-full overflow-y-auto flex-col items-center justify-center p-4 text-center">
          <ClipboardPaste className="h-8 w-8 text-blue-500" />
          <p className="mt-3 text-sm font-semibold text-slate-800">{metadataOnly ? "Transcript unavailable" : "Add the YouTube transcript"}</p>
          <p className="max-w-xs text-xs leading-5 text-slate-500">
            {metadataOnly
              ? "Video information is ready, but a transcript could not be retrieved from YouTube."
              : "Open Show transcript on YouTube, copy its timestamped text, then paste it here."}
          </p>
          <button type="button" onClick={onPasteTranscript} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            Import Transcript
          </button>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 p-2">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-400 focus-within:bg-white">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input aria-label="Search transcript" value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Search transcript" className="min-w-0 flex-1 bg-transparent text-base sm:text-sm outline-none" />
            </label>
            <button type="button" onClick={locateCurrentSegment} disabled={!activeSegment || !visibleSegments.includes(activeSegment)} title="Jump to current playback" aria-label="Jump to current playback" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-35">
              <LocateFixed className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onPasteTranscript} title="Replace transcript" aria-label="Replace transcript" className="inline-flex h-10 min-w-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <ClipboardPaste className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Replace</span>
            </button>
          </div>
          <div className="flex shrink-0 items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <span>{visibleSegments.length.toLocaleString()} segments</span>
            {deferredQuery !== query && <span className="normal-case tracking-normal text-blue-500">Searching…</span>}
          </div>
          <div ref={scrollRef} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)} className="h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 [scrollbar-width:thin]">
            {visibleSegments.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">No transcript segments match your search.</p>
            ) : (
              <div className="relative" style={{ height: visibleSegments.length * ROW_HEIGHT }}>
                {windowedSegments.map((segment, offset) => {
                  const virtualIndex = startIndex + offset;
                  const isCurrent = activeSegment === segment;
                  return (
                    <button
                      type="button"
                      key={`${segment.startSeconds}-${virtualIndex}`}
                      aria-label={`${formatSeconds(segment.startSeconds)} ${segment.text}`}
                      aria-current={isCurrent ? "true" : undefined}
                      aria-posinset={virtualIndex + 1}
                      aria-setsize={visibleSegments.length}
                      onClick={() => requestSeekTo(segment.startSeconds)}
                      style={{ top: virtualIndex * ROW_HEIGHT, height: ROW_HEIGHT - 4 }}
                      className={`absolute left-0 flex w-full min-w-0 gap-2 sm:gap-3 overflow-hidden rounded-xl border px-2.5 py-1.5 text-xs text-left transition-colors ${isCurrent ? "border-blue-200 bg-blue-50 text-blue-900" : "border-transparent text-slate-600 hover:bg-slate-50"}`}
                    >
                      {showTranscriptTimestamps && (
                        <span className={`shrink-0 pt-0.5 tabular-nums text-xs ${isCurrent ? "font-bold text-blue-600" : "text-slate-400"}`}>
                          {formatSeconds(segment.startSeconds)}
                        </span>
                      )}
                      <span className="min-w-0 break-words line-clamp-2 leading-5">{segment.text}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
