import { useDialogFocus } from "@/components/ui/useDialogFocus";
import React, { useDeferredValue, useRef, useState } from "react";
import { ClipboardPaste, X } from "lucide-react";
import { notify } from "@/lib/toast";
import { BrandLoader } from "@/components/ui/BrandLoader";

interface TranscriptImportDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (transcript: string) => Promise<boolean>;
}

const inspectTranscriptTimestamps = (transcript: string) => {
  let timestampCount = 0;
  let invalidTimestampCount = 0;

  for (const line of transcript.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d{1,4}(?:[:.]\d{1,4}){1,2})(?=\s|$)/);
    if (!match) continue;

    const token = match[1];
    if (!token) continue;
    const parts = token.split(":");
    const validShape = parts.length === 2 || parts.length === 3;
    const values = parts.map(Number);
    const validRange =
      validShape &&
      values.every(Number.isInteger) &&
      (values.at(-1) ?? 60) < 60 &&
      (parts.length !== 3 || (values[1] ?? 60) < 60);

    if (validRange) timestampCount += 1;
    else invalidTimestampCount += 1;
  }

  return { timestampCount, invalidTimestampCount };
};

export const TranscriptImportDialog: React.FC<TranscriptImportDialogProps> = ({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [transcript, setTranscript] = useState("");
  const pendingRef = useRef(false);
  const [isParsing, setIsParsing] = useState(false);
  const busy = isSubmitting || isParsing;
  const deferredTranscript = useDeferredValue(transcript);
  const panelRef = useDialogFocus<HTMLDivElement>(isOpen, () => { if (!pendingRef.current && !isSubmitting) onClose(); });
  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!transcript.trim() || isSubmitting || pendingRef.current) return;
    const timestampStats = inspectTranscriptTimestamps(transcript);
    if (timestampStats.invalidTimestampCount > 0) {
      notify.warningToast(
        "Check transcript timestamps",
        timestampStats.invalidTimestampCount + " timestamp line(s) use an unsupported format. Use MM:SS or H:MM:SS with values below 60 for seconds and minutes.",
      );
      return;
    }
    pendingRef.current = true;
    setIsParsing(true);
    try {
      if (await onSubmit(transcript.trim())) setTranscript("");
    } finally { pendingRef.current = false; setIsParsing(false); }
  };
  const timestampCount = inspectTranscriptTimestamps(deferredTranscript).timestampCount;

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Paste YouTube transcript" tabIndex={-1} className="ux-overlay fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm">
      <form
        onSubmit={submit}
        aria-busy={busy}
        className="ux-dialog flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="font-bold text-slate-950">
              Paste YouTube transcript
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              In YouTube, open <strong>Show transcript</strong>, copy the
              complete timestamped text, and paste it below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
              disabled={busy}
            aria-label="Close transcript import"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 md:grid-cols-[1fr_12rem]">
          <textarea
            data-dialog-autofocus
            aria-label="Timestamped transcript"
            aria-describedby="transcript-import-hint"
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            disabled={busy}
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            maxLength={500_000}
            placeholder={
              "Introduction\n0:00\nTranscript text...\n0:06\nNext transcript segment..."
            }
            className="min-h-[12rem] md:min-h-[22rem] resize-y rounded-xl border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-5 text-blue-950">
            <p className="font-bold">Supported timestamps</p>
            <p className="mt-1">MM:SS and H:MM:SS</p>
            <p className="mt-3 font-bold">What happens</p>
            <p className="mt-1">
              Every timestamp becomes a clickable transcript segment. Native
              chapter headings are kept in the Chapters section. AI runs only when you choose Create structured draft afterward.
            </p>
          </div>
        </div>

        <p id="transcript-import-hint" role="status" aria-live="polite" className="px-4 pb-3 text-xs leading-5 text-slate-500">
          {busy ? "Reading timestamps and preparing your transcript. AI drafting starts only when you choose it afterward." : "Tip: press Ctrl+Enter or ⌘+Enter to parse. Your pasted text stays here if parsing fails."}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <span className="text-[11px] text-slate-400">
            {transcript.length.toLocaleString()} / 500,000 characters ·{" "}
            {timestampCount.toLocaleString()} timestamps found
          </span>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="min-h-10 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !transcript.trim()}
              className="inline-flex min-h-10 min-w-40 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
            >
              {busy ? (
                <BrandLoader size="xs" tone="inverse" />
              ) : (
                <ClipboardPaste className="h-3.5 w-3.5" />
              )}
              {busy ? "Parsing transcript..." : "Parse transcript"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
