import { useDialogFocus } from "@/components/ui/useDialogFocus";
import React, { useRef } from "react";
import { CheckCircle2, Copy, ExternalLink, X } from "lucide-react";
import { notify } from "@/lib/toast";

interface ShareNoteDialogProps {
  isOpen: boolean;
  shareUrl: string;
  onClose: () => void;
}

export const ShareNoteDialog: React.FC<ShareNoteDialogProps> = ({
  isOpen,
  shareUrl,
  onClose,
}) => {
  const panelRef = useDialogFocus<HTMLDivElement>(isOpen, onClose);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      notify.success("Link copied", "The read-only note link is ready to share.");
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      notify.error("Copy unavailable", "The link is selected. Copy it manually with Ctrl+C.");
    }
  };

  return (
    <div
      ref={panelRef} tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-note-title"
    >
      <div className="ux-dialog w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start gap-3 p-4">
          <span className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="share-note-title" className="text-sm font-bold text-slate-900">
              Read-only note created
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Anyone with this link can view this saved version. Later editor changes do not alter it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close share dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 p-4">
          <label htmlFor="shared-note-url" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Shareable link
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              ref={inputRef}
              id="shared-note-url"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy link
            </button>
          </div>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Preview shared note
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
