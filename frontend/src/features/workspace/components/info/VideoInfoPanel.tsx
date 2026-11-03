// src/features/workspace/components/info/VideoInfoPanel.tsx
import React from "react";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { User, Clock, Sparkles, FileText, Languages } from "lucide-react";
import { resolveOutputLanguage } from "../../utils/outputLanguage";
import { hasUsableTranscriptEvidence } from "@/features/extraction/utils/transcriptEvidence";
import { useShallow } from "zustand/react/shallow";

export const VideoInfoPanel: React.FC = () => {
  const { activeVideo, preferredLanguage } = useWorkspaceStore(useShallow(state => ({
    activeVideo: state.activeVideo,
    preferredLanguage: state.activeVideo ? state.videoPreferences[state.activeVideo.videoId]?.targetLanguage : undefined,
  })));

  if (!activeVideo) {
    return (
      <div className="p-4 text-center text-xs text-slate-400">
        No video data available.
      </div>
    );
  }

  const hasTranscript = hasUsableTranscriptEvidence(activeVideo);
  const verified = activeVideo.verificationLevel === "SEMANTIC_VERIFIED"
    && ["EDUCATIONAL", "INFORMATIONAL"].includes(activeVideo.contentEligibility ?? "");
  const sourceLanguage = activeVideo.transcriptLanguage?.trim();
  const transcriptLanguage = !sourceLanguage || ["und", "unknown", "original"].includes(sourceLanguage.toLowerCase())
    ? "Not identified" : sourceLanguage;
  const aiStatus = activeVideo.aiStatus;
  const draftStatus = aiStatus === "QUEUED" ? "Queued"
    : aiStatus === "PROCESSING" ? "Creating draft"
    : aiStatus === "COMPLETED" ? "Draft created"
    : aiStatus === "FAILED" ? "Draft interrupted"
    : aiStatus === "SKIPPED_UNAVAILABLE" ? "Temporarily unavailable"
    : aiStatus === "SKIPPED_QUOTA" ? "Provider limit reached"
    : "Not requested";

  return (
    <div className="min-w-0 p-3 sm:p-4 overflow-y-auto overscroll-contain h-full space-y-3 text-xs [overflow-wrap:anywhere]">
      <div>
        <h2 className="font-semibold text-sm leading-relaxed text-slate-900 mb-2">
          {activeVideo.title}
        </h2>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2 text-slate-500 text-xs">
          <span className="flex min-w-0 items-start gap-1.5">
            <User className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
            {activeVideo.channelName || "Unknown Channel"}
          </span>
          <span className="flex min-w-0 items-start gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
            {activeVideo.duration || "N/A"}
          </span>
        </div>
      </div>

      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>Note details</span>
        </div>
        <p className="text-slate-500 text-xs leading-5">
          Transcript:{" "}
          <strong className="text-slate-700">
            {hasTranscript ? "Ready" : "Unavailable"}
          </strong>
        </p>
        <p className="flex flex-wrap items-center gap-1.5 text-slate-500 text-xs leading-5">
          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          Source: {activeVideo.noteSource === "METADATA"
            ? "Video information"
            : activeVideo.noteSource === "USER_PROVIDED"
              ? "Pasted transcript"
              : "Accessible YouTube transcript"}
        </p>
        {hasTranscript && (
          <p className="flex flex-wrap items-center gap-1.5 text-slate-500 text-xs leading-5">
            <Languages className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            Original transcript: <strong className="text-slate-700">{transcriptLanguage}</strong>
          </p>
        )}
        <p className="text-slate-500 text-xs leading-5">
          Verification: <strong className="text-slate-700">{verified ? "Verified for educational notes" : "Not verified"}</strong>
        </p>
        <p className="text-slate-500 text-xs leading-5">
          AI draft: <strong className="text-slate-700">{draftStatus}</strong>
        </p>
        {hasTranscript && (
          <p className="text-slate-500 text-xs leading-5">
            Selected output language: <strong className="text-slate-700">{resolveOutputLanguage(preferredLanguage ?? activeVideo.targetLanguage)}</strong>
          </p>
        )}
      </div>

      {!verified && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
          {hasTranscript ? "Your transcript is ready. Verification runs when you choose Create structured draft; parsing alone does not verify it." : "Import a transcript before creating an AI draft. Video information alone cannot be verified as transcript evidence."}
        </div>
      )}
    </div>
  );
};
