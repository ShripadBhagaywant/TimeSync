import { canRefineWithAi, hasUsableTranscriptEvidence } from "@/features/extraction/utils/transcriptEvidence";
import { AlertCircle, Languages, Sparkles } from "lucide-react";
import { BrandLoader } from "@/components/ui/BrandLoader";
import type { TranscriptResponse, PlaylistTranscriptResponse } from "@/features/extraction/types/extraction.types";
import type { EditorDisplayMode } from "./editor/editorFormatting";
import { LanguageSelect } from "./LanguageSelect";
import { AiRetryButton } from "./AiRetryButton";

interface Props {
  activeVideo: TranscriptResponse;
  playlistData: PlaylistTranscriptResponse | null;
  visiblePendingAiDraft: TranscriptResponse | null;
  editorDisplayMode: EditorDisplayMode;
  targetLanguage: string;
  setTargetLanguage: (language: string) => void;
  isStartingAi: boolean;
  aiRetryKey: string | null;
  activeVideoHasPlaylistSection: boolean;
  startAiRefinement: () => Promise<void>;
  applyAiDraft: () => Promise<void>;
  restoreOriginalDraft: () => Promise<void>;
  discardPendingAiDraft: (videoId: string) => void;
}
export const WorkspaceAiStatus = ({
  activeVideo,
  playlistData,
  visiblePendingAiDraft,
  editorDisplayMode,
  targetLanguage,
  setTargetLanguage,
  isStartingAi,
  aiRetryKey,
  activeVideoHasPlaylistSection,
  startAiRefinement,
  applyAiDraft,
  restoreOriginalDraft,
  discardPendingAiDraft,
}: Props) => {
  if (!canRefineWithAi(activeVideo)) {
    return editorDisplayMode === "minimized" ? null : (
      <div role="status" className="ux-status mb-1.5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-900">
        {hasUsableTranscriptEvidence(activeVideo) ? <>
          <p>This content is not available for AI refinement.</p>
        </> : <>
          <p>Transcript unavailable.</p>
          <p>Import a transcript, then choose Create structured draft to start AI verification and drafting.</p>
        </>}
      </div>
    );
  }

  const aiFailureStatuses = [
    "FAILED",
    "SKIPPED_QUOTA",
    "SKIPPED_UNAVAILABLE",
  ] as const;

  const hasAiFailure = Boolean(
    activeVideo?.aiStatus &&
    aiFailureStatuses.includes(
      activeVideo.aiStatus as (typeof aiFailureStatuses)[number],
    ),
  );

  const canRetryAi =
    activeVideo?.aiStatus === "FAILED" ||
    activeVideo?.aiStatus === "SKIPPED_UNAVAILABLE";

  return (<>
    {editorDisplayMode !== "minimized" &&
      hasUsableTranscriptEvidence(activeVideo) &&
      ![
        "QUEUED",
        "PROCESSING",
        "FAILED",
        "SKIPPED_QUOTA",
        "SKIPPED_UNAVAILABLE",
      ].includes(activeVideo.aiStatus ?? "") &&
      !visiblePendingAiDraft && (
        <div className="ux-status mb-1.5 flex shrink-0 flex-wrap items-center justify-between gap-1.5 rounded-xl border-b border-slate-200 bg-white px-2 py-1">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700">
            <Languages className="h-4 w-4 text-blue-600" />
            <LanguageSelect
              value={targetLanguage}
              disabled={isStartingAi}
              onChange={setTargetLanguage}
            />
          </div>
          <button
            type="button"
            onClick={startAiRefinement}
            disabled={isStartingAi}
            aria-busy={isStartingAi}
            className="inline-flex min-h-8 max-w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStartingAi ? (
              <BrandLoader size="xs" tone="inverse" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {isStartingAi ? "Checking transcript…" : "Create structured draft"}
          </button>
        </div>
      )}
    {editorDisplayMode !== "minimized" &&
      activeVideo.aiStatus &&
      ["QUEUED", "PROCESSING"].includes(activeVideo.aiStatus) &&
      !visiblePendingAiDraft && (
        <div
          className="ux-status shrink-0 border-b rounded-lg mb-1.5 border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-950"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <BrandLoader size="sm" />
            <div>
              <p className="break-words font-semibold">{activeVideo.aiStatus === "QUEUED" ? "AI draft queued" : "Structuring AI draft"}</p>
              <p className="mt-0.5 text-[11px] text-blue-800">
                {activeVideo.aiStatus === "QUEUED" ? "Waiting to prepare a " : "Preparing a "}
                {activeVideo.targetLanguage || "selected-language"}{" "}
                draft in the background.
              </p>
            </div>
          </div>
        </div>
      )}
    {editorDisplayMode !== "minimized" && visiblePendingAiDraft && (
      <div
        className="ux-status shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-950"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 text-emerald-600" />
            <div>
              <p className="break-words font-semibold">
                AI draft ready for “{visiblePendingAiDraft.title}”
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-800">
                Draft language: {visiblePendingAiDraft.targetLanguage || "English"}. Review it when ready. Your current editor document has
                not been overwritten.
              </p>
            </div>
          </div>
          <div className="flex max-w-full flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                discardPendingAiDraft(visiblePendingAiDraft.videoId)
              }
              className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={applyAiDraft}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
            >
              {playlistData
                ? activeVideoHasPlaylistSection
                  ? "Update Existing Section"
                  : "Add to Playlist Notes"
                : "Apply AI draft"}
            </button>
          </div>
        </div>
      </div>
    )}
    {editorDisplayMode !== "minimized" &&
      hasAiFailure &&
      !visiblePendingAiDraft && (
        <div
          className="ux-status mb-1.5 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="break-words font-semibold">
                    {activeVideo.retryAfterSeconds != null &&
                    activeVideo.retryAfterSeconds > 0
                      ? "Gemini is temporarily unavailable"
                      : "AI draft could not be completed"}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">
                    {activeVideo.aiMessage ||
                      "The AI provider is temporarily unavailable. Your original transcript remains safe."}
                  </p>
                  {activeVideo.retryAfterSeconds != null &&
                    activeVideo.retryAfterSeconds > 0 && (
                      <p className="mt-1 text-[10px] font-medium text-amber-700">
                        Your transcript and current editor notes are safe. The app
                        will not retry automatically; use the retry button when
                        its countdown ends.
                      </p>
                    )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canRetryAi && (
                <AiRetryButton
                  isStartingAi={isStartingAi}
                  retryAfterSeconds={activeVideo.retryAfterSeconds}
                  retryKey={aiRetryKey}
                  onRetry={startAiRefinement}
                />
              )}

              <button
                type="button"
                onClick={restoreOriginalDraft}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-100"
              >
                Restore original draft
              </button>
            </div>
          </div>
        </div>
      )}
  </>);
};
