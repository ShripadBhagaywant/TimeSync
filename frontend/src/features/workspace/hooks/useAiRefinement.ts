import { startProcess } from "@/lib/processManager";
import { resolveOutputLanguage } from "../utils/outputLanguage";
import { ApiError } from "@/lib/apiError";
import { getUserFacingApiError } from "@/features/extraction/utils/extractionErrors";
import { notifyApiError } from "@/lib/apiErrorNotifications";
import { canRefineWithAi, hasUsableTranscriptEvidence, transcriptEvidenceText } from "@/features/extraction/utils/transcriptEvidence";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkspaceStore } from "../store/workspaceStore";
import { extractionApi } from "@/features/extraction/api/extractionApi";
import { getTranscriptSource, saveVideoWorkspace } from "@/lib/indexDB";
import { notify } from "@/lib/toast";

export const useAiRefinement = (setIsTranscriptDialogOpen: Dispatch<SetStateAction<boolean>>) => {
  const {
    activeVideo,
    preferredLanguage,
    replaceVideoResponse,
    setPendingAiDraft,
  } = useWorkspaceStore(useShallow(state => ({
    activeVideo: state.activeVideo,
    preferredLanguage: state.activeVideo ? state.videoPreferences[state.activeVideo.videoId]?.targetLanguage : undefined,
    replaceVideoResponse: state.replaceVideoResponse,
    setPendingAiDraft: state.setPendingAiDraft,
  })));
  const hasTranscriptEvidence = canRefineWithAi(activeVideo);
  const isAiJobActive = ["QUEUED", "PROCESSING"].includes(activeVideo?.aiStatus ?? "");
  const [startingVideos, setStartingVideos] = useState<Record<string, boolean>>({});
  const isStartingAi = Boolean(activeVideo && startingVideos[activeVideo.videoId]);
  const startingRef = useRef(new Set<string>());
  const targetLanguage = resolveOutputLanguage(preferredLanguage ?? activeVideo?.targetLanguage);
  const setTargetLanguage = (language: string) => {
    // A completed job can retain its historical job ID in its response. Only
    // an active job should lock the language selector.
    if (!activeVideo || startingRef.current.has(activeVideo.videoId) || ["QUEUED", "PROCESSING"].includes(activeVideo.aiStatus ?? "")) return;
    useWorkspaceStore.setState(state => ({ videoPreferences: { ...state.videoPreferences, [activeVideo.videoId]: { ...state.videoPreferences[activeVideo.videoId], isStarred: state.videoPreferences[activeVideo.videoId]?.isStarred ?? false, targetLanguage: resolveOutputLanguage(language) } } }));
  };

  useEffect(() => {
    const videoId = activeVideo?.videoId;
    if (!videoId) return;
    let cancelled = false;
    const original = useWorkspaceStore.getState().activeVideo;
    void getTranscriptSource(videoId).then(saved => {
      const current = useWorkspaceStore.getState().activeVideo;
      if (!cancelled && current === original && saved?.pendingAiDraft?.videoId === videoId
          && transcriptEvidenceText(saved.response) === transcriptEvidenceText(current)) {
        setPendingAiDraft(videoId, saved.pendingAiDraft);
      }
    }).catch(() => { /* Storage failure is reported by workspace restoration. */ });
    return () => { cancelled = true; };
  }, [activeVideo?.videoId, setPendingAiDraft]);
  const [aiRetryGeneration, setAiRetryGeneration] = useState(0);
  const aiRetryKey = activeVideo
    ? `${activeVideo.videoId}:${aiRetryGeneration}`
    : null;

  useEffect(() => {
    const jobId = activeVideo?.aiJobId;
    if (
      !hasTranscriptEvidence ||
      !jobId ||
      !isAiJobActive
    ) {
      return;
    }

    const process = startProcess("ai-draft-monitor");
    process.stage("Waiting for AI draft");
    let cancelled = false;
    let timer: number | undefined;
    let consecutiveFailures = 0;
    const poll = async () => {
      try {
        const job = await extractionApi.getAiNoteJob(jobId);
        if (cancelled || useWorkspaceStore.getState().activeVideo?.aiJobId !== jobId) return;
        consecutiveFailures = 0;
        process.stage(job.status === "PROCESSING" ? "Creating draft" : "Waiting for AI draft");
        if (job.status === "COMPLETED" && (!job.result || job.result.videoId !== activeVideo.videoId || !job.result.cleanedTranscript?.trim())) {
          replaceVideoResponse({ ...useWorkspaceStore.getState().activeVideo!, aiStatus: "FAILED", aiJobId: null,
            aiMessage: "AI returned an incomplete draft. Your transcript and notes are unchanged. Please retry." });
          process.finish("failed");
          return;
        }
        if (job.status === "COMPLETED" && job.result) {
          const source = useWorkspaceStore.getState().activeVideo!;
          try {
            await saveVideoWorkspace({ ...source, aiStatus: "COMPLETED", aiJobId: null }, job.result);
          } catch {
            notify.error("AI draft not saved", "Keep this tab open. Browser storage could not save the generated draft.");
          }
          if (cancelled || useWorkspaceStore.getState().activeVideo?.aiJobId !== jobId) return;
          process.finish();
          setPendingAiDraft(job.result.videoId, job.result);
          return;
        }
        if (job.status === "FAILED") {
          process.finish("failed");
          const source = useWorkspaceStore.getState().activeVideo!;
          replaceVideoResponse({ ...source, aiStatus: "FAILED", aiJobId: null,
            aiMessage: job.message || "AI drafting failed. Your transcript and editor content are unchanged.",
            retryAfterSeconds: job.retryAfterSeconds ?? job.result?.retryAfterSeconds ?? null });
          setAiRetryGeneration(value => value + 1);
          return;
        }
        if (job.status === "PROCESSING" && useWorkspaceStore.getState().activeVideo?.aiStatus !== "PROCESSING") {
          replaceVideoResponse({ ...useWorkspaceStore.getState().activeVideo!, aiStatus: "PROCESSING" });
        }
        timer = window.setTimeout(poll, 2_000);
      } catch (error) {
        if (!cancelled && useWorkspaceStore.getState().activeVideo?.aiJobId === jobId) {
          const expired = error instanceof ApiError && error.status === 404;
          const transient = !(error instanceof ApiError) || error.status === undefined
            || error.status === 429 || error.status >= 500;
          if (transient && consecutiveFailures < 3) {
            consecutiveFailures += 1;
            process.stage("Reconnecting to AI progress");
            const retrySeconds = error instanceof ApiError ? error.retryAfterSeconds : null;
            timer = window.setTimeout(poll, Math.max(2 ** consecutiveFailures, retrySeconds ?? 0) * 1_000);
            return;
          }
          process.finish("failed");
          const message = expired
            ? "This AI job expired or the server restarted. Your notes are unchanged. Create a new draft when ready."
            : "Unable to check AI progress. Your notes are unchanged. Retry to check this existing job again.";
          replaceVideoResponse({ ...useWorkspaceStore.getState().activeVideo!, aiStatus: "FAILED", aiJobId: expired ? null : jobId, aiMessage: message });
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      process.finish("cancelled");
    };
  }, [
    hasTranscriptEvidence,
    activeVideo?.videoId,
    activeVideo?.aiJobId,
    isAiJobActive,
    replaceVideoResponse,
    setPendingAiDraft,
  ]);

  const startAiRefinement = useCallback(async () => {
    if (!activeVideo || !canRefineWithAi(activeVideo)) {
      if (!hasUsableTranscriptEvidence(activeVideo)) setIsTranscriptDialogOpen(true);
      return;
    }

    if (activeVideo.aiStatus === "FAILED" && activeVideo.aiJobId) {
      replaceVideoResponse({ ...activeVideo, aiStatus: "QUEUED", aiMessage: undefined });
      return;
    }

    const latest = useWorkspaceStore.getState().activeVideo;
    if (latest?.videoId !== activeVideo.videoId || ["QUEUED", "PROCESSING"].includes(latest.aiStatus ?? "")) return;
    if (startingRef.current.has(activeVideo.videoId)) {
      return;
    }

    startingRef.current.add(activeVideo.videoId);
    setStartingVideos(previous => ({ ...previous, [activeVideo.videoId]: true }));

    try {
      const response = await extractionApi.refineTranscript({
        videoId: activeVideo.videoId,
        transcript: transcriptEvidenceText(activeVideo),
        transcriptSegments: activeVideo.transcriptSegments ?? [],
        transcriptLanguage: activeVideo.transcriptLanguage,
        chapters: activeVideo.chapters ?? [],
        editableChapters: activeVideo.isEditableChapters,
        targetLanguage,
      });

      const current = useWorkspaceStore.getState().activeVideo;
      if (current?.videoId !== activeVideo.videoId || transcriptEvidenceText(current) !== transcriptEvidenceText(activeVideo)) return;
      replaceVideoResponse(response);

      if (
        response.aiStatus === "FAILED" ||
        response.aiStatus === "SKIPPED_UNAVAILABLE"
      ) {
        setAiRetryGeneration((value) => value + 1);
      }

      if (response.aiStatus === "QUEUED") {
        return;
      }

      if (response.aiStatus === "SKIPPED_UNAVAILABLE") {
        return;
      }

      if (response.aiStatus === "SKIPPED_QUOTA") {
        return;
      }

      if (response.aiStatus === "FAILED") {
        return;
      }
    } catch (error) {
      const current = useWorkspaceStore.getState().activeVideo;
      if (current?.videoId !== activeVideo.videoId || transcriptEvidenceText(current) !== transcriptEvidenceText(activeVideo)) return;
      const providerFailure = error instanceof ApiError && ["AI_PROVIDER_UNAVAILABLE", "AI_PROVIDER_QUOTA_EXCEEDED"].includes(error.code ?? "");
      if (providerFailure) {
        replaceVideoResponse({ ...current, aiStatus: "FAILED", aiJobId: null,
          aiMessage: getUserFacingApiError(error, "Verification could not finish. Your transcript and notes are unchanged."),
          retryAfterSeconds: error.retryAfterSeconds ?? 30 });
        setAiRetryGeneration(value => value + 1);
      }
      if (!providerFailure) {
        notifyApiError(
          error,
          "Unable to start AI",
          "AI refinement could not be started. Your notes are unchanged. Please try again.",
        );
      }
    } finally {
      startingRef.current.delete(activeVideo.videoId);
      setStartingVideos(previous => { const next = { ...previous }; delete next[activeVideo.videoId]; return next; });
    }
  }, [activeVideo, replaceVideoResponse, targetLanguage, setIsTranscriptDialogOpen]);

  return { isStartingAi, targetLanguage, setTargetLanguage, aiRetryKey, startAiRefinement };
};
