import { runProcess } from "@/lib/processManager";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
// src/features/workspace/components/export/ExportModal.tsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  FileText,
  FileCode,
  File,
  X,
  Download,
  LucideIcon,
} from "lucide-react";
import { BrandLoader } from "@/components/ui/BrandLoader";
import type { ExportFormat } from "../../utils/exportUtils";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { notify } from "@/lib/toast";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  editorHtmlContent: string;
  workspaceType?: "single" | "playlist";
  videoCount?: number;
}

interface ExportOption {
  id: ExportFormat;
  title: string;
  desc: string;
  icon: LucideIcon;
  badge?: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "pdf",
    title: "PDF Document (.pdf)",
    desc: "Polished study notes with tables, code, images, and timestamps.",
    icon: FileText,
    badge: "Popular",
  },
  {
    id: "markdown",
    title: "Markdown (.md)",
    desc: "Preserves headings, lists, and formatted code blocks.",
    icon: FileCode,
  },
  {
    id: "text",
    title: "Plain Text (.txt)",
    desc: "Simple, lightweight raw text without markdown tags.",
    icon: File,
  },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  editorHtmlContent,
  workspaceType = "single",
  videoCount,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("pdf");
  const [isExporting, setIsExporting] = useState(false);
  const exportingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const [progress, setProgress] = useState("Preparing export…");
  const panelRef = useDialogFocus<HTMLDivElement>(isOpen, () => { if (!exportingRef.current) onClose(); });
  const selectedVideoId = useWorkspaceStore(
    (state) => state.activeVideo?.videoId,
  );
  const activeVideoId = workspaceType === "single" ? selectedVideoId : undefined;
  const hasContent = Boolean(
    editorHtmlContent && (editorHtmlContent.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim() || /<img\b/i.test(editorHtmlContent)),
  );
  const exportContextLabel =
    workspaceType === "playlist"
      ? `Playlist export · ${videoCount ?? 0} videos`
      : "Single video export";

  const handleDownload = useCallback(async () => {
    if (exportingRef.current) return;
    if (!hasContent) {
      notify.error("Nothing to export", "Add notes or transcript content before exporting.");
      return;
    }

    exportingRef.current = true;
    setIsExporting(true);
    setProgress("Preparing export…");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { exportDocument } = await import("../../utils/exportUtils");
      await runProcess("notes-export", async process => {
        controller.signal.throwIfAborted();
        await exportDocument(
          documentTitle,
          editorHtmlContent,
          selectedFormat,
          activeVideoId,
          { signal: process.signal, onProgress: message => { process.stage(message); if (!process.signal.aborted) setProgress(message); }, alignment: "justify", delivery: "download" },
        );
      }, controller.signal);
      onClose();
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) { notify.info("Export cancelled", "Your notes are unchanged."); return; }
      notify.error("Export Failed", "Unable to generate the requested file. Your editor contents are unchanged; please try again.");
    } finally {
      abortRef.current = null;
      exportingRef.current = false;
      setIsExporting(false);
    }
  }, [
    hasContent,
    documentTitle,
    editorHtmlContent,
    selectedFormat,
    activeVideoId,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-busy={isExporting} aria-label="Export notes" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4">
      <div className="ux-dialog max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <div className="p-3 px-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Export Notes</h3>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 mt-1">
              {exportContextLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close export modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Options */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 font-medium mb-1">
            Choose export format for{" "}
            <span className="text-slate-900 font-semibold">"{documentTitle}"</span>
            :
          </p>

          {EXPORT_OPTIONS.map((fmt) => {
            const Icon = fmt.icon;
            const isSelected = selectedFormat === fmt.id;
            return (
              <button
                type="button"
                key={fmt.id}
                onClick={() => !isExporting && setSelectedFormat(fmt.id)}
                disabled={isExporting}
                aria-pressed={isSelected}
                className={`relative flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {fmt.title}
                    </span>
                    {fmt.badge && (
                      <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-full">
                        {fmt.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                    {fmt.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {!hasContent && (
          <div className="px-6 pb-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              No notes are available to export yet. Write a note or add transcript content first.
            </div>
          </div>
        )}

        {isExporting && <p role="status" aria-live="polite" className="px-6 pb-4 text-sm text-slate-600">{progress}</p>}

        {/* Actions */}
        <div className="p-3 px-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={() => { if (isExporting) { abortRef.current?.abort(); setProgress("Cancelling…"); } else onClose(); }}
            className="min-h-11 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={isExporting || !hasContent}
            className="min-h-11 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <BrandLoader size="xs" tone="inverse" />
                <span>Exporting…</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{selectedFormat === "pdf" ? "Download PDF" : "Download File"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
