import { isMetadataWorkspace } from "../utils/transcriptEvidence";
import React, { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ListVideo } from "lucide-react";
import { notify } from "@/lib/toast";
import { ApiError } from "@/lib/apiError";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { getUserFacingApiError } from "@/features/extraction/utils/extractionErrors";
import { notifyApiError } from "@/lib/apiErrorNotifications";
import { useLoadingStore } from "@/lib/loadingStore";
import {
  useVideoExtraction,
  usePlaylistExtraction,
} from "../hooks/useVideoExtraction";
import { classifyYouTubeInput } from "../utils/youtubeUrl";

// ============================================================================
// CONSTANTS & SCHEMAS
// ============================================================================

const mediaUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Please enter a YouTube video or playlist URL")
    .refine((val) => classifyYouTubeInput(val) !== null, {
      message:
        "Invalid YouTube URL format. Enter a valid YouTube video or playlist link.",
    }),
});

type UrlFormData = z.infer<typeof mediaUrlSchema>;

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const YouTubeIcon: React.FC<{ className?: string }> = ({
  className = "w-5 h-5",
}) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const UrlInputForm: React.FC = () => {
  const navigate = useNavigate();
  const videoMutation = useVideoExtraction();
  const playlistMutation = usePlaylistExtraction();
  const { startLoading, stopLoading } = useLoadingStore();
  const pendingOperations = useRef(new Set<number>());
  useEffect(() => {
    const operations = pendingOperations.current;
    return () => {
      for (const id of operations) stopLoading(id);
      operations.clear();
    };
  }, [stopLoading]);

  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<UrlFormData>({
    resolver: zodResolver(mediaUrlSchema),
    defaultValues: {
      url: "",
    },
  });

  const inputUrl = useWatch({ control, name: "url" });
  const isPlaylist = classifyYouTubeInput(inputUrl) === "playlist";

  // Form submission handler with dynamic single video vs playlist extraction
  const onSubmit = (data: UrlFormData) => {
    if (pendingOperations.current.size > 0 || videoMutation.isPending || playlistMutation.isPending) return;
    const isPlaylistTarget = classifyYouTubeInput(data.url) === "playlist";

    if (isPlaylistTarget) {
      const loadingId = startLoading({
        title: "Extracting playlist",
        message: "Getting videos, chapters, and editable notes ready.",
      });

      pendingOperations.current.add(loadingId);
      playlistMutation.mutate(
        {
          playlistUrl: data.url,
        },
        {
          onSuccess: (responseData) => {
            stopLoading(loadingId);
            pendingOperations.current.delete(loadingId);
            notify.success(
              "Playlist extracted successfully!",
              `Processed ${responseData.processedVideos} / ${responseData.attemptedVideos} attempted videos.`,
            );

            const initialVideo = responseData.videoNotes[0];
            if (!initialVideo) {
              notify.errorToast(
                "Playlist has no usable videos",
                "No processed video was returned by the server.",
              );
              return;
            }
            navigate(
              `/workspace/playlist/${responseData.playlistId}/video/${initialVideo.videoId}`,
              {
                state: { playlistData: responseData },
              },
            );
          },
          onError: (error) => {
            stopLoading(loadingId);
            pendingOperations.current.delete(loadingId);
            notifyApiError(
              error,
              "Playlist Extraction Failed",
              getUserFacingApiError(
                error,
                "Unable to process playlist. Please verify the URL.",
              ),
              "toast",
            );
          },
        },
      );
    } else {
      const loadingId = startLoading({
        title: "Preparing workspace",
        message: "Collecting the available video sources without running AI.",
      });

      pendingOperations.current.add(loadingId);
      videoMutation.mutate(
        {
          url: data.url,
        },
        {
          onSuccess: (responseData) => {
            stopLoading(loadingId);
            pendingOperations.current.delete(loadingId);
            notify.success(
              isMetadataWorkspace(responseData) ? "Video workspace ready" : "Notes generated successfully!",
              isMetadataWorkspace(responseData)
                ? "Transcript unavailable. You can take notes or import a transcript in the workspace."
                : `Redirecting for "${responseData.title || "Video"}"`,
            );

            navigate(`/workspace/video/${responseData.videoId}`, {
              state: { transcriptData: responseData },
            });
          },
          onError: (error) => {
            stopLoading(loadingId);
            pendingOperations.current.delete(loadingId);
            notifyApiError(
              error,
              error instanceof ApiError && error.code === "NON_EDUCATIONAL_CONTENT"
                ? "Video not eligible"
                : "Extraction Failed",
              getUserFacingApiError(
                error,
                "Unable to process video. Please verify the URL.",
              ),
              "toast",
            );
          },
        },
      );
    }
  };

  const onError = (errors: Record<string, { message?: string }>) => {
    if (errors.url?.message) {
      notify.warningToast("Check URL Input", errors.url.message);
    }
  };

  const isPending =
    videoMutation.isPending || playlistMutation.isPending || isSubmitting;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      <form
        onSubmit={event => { void handleSubmit(onSubmit, onError)(event); }}
        className="w-full space-y-2.5"
      >
        {/* Primary Input Container */}
        <div className="relative flex flex-col sm:flex-row items-stretch gap-2 p-2 bg-white border border-slate-200/90 rounded-2xl shadow-lg shadow-slate-200/40 focus-within:ring-2 focus-within:ring-blue-500/80 focus-within:border-transparent transition-all duration-200">
          {/* URL Input Area */}
          <div className="flex items-center min-w-0 flex-1 px-3 py-2 sm:py-0 gap-2.5">
            <div className="flex-shrink-0 transition-transform duration-200 hover:scale-105">
              {isPlaylist ? (
                <ListVideo className="w-6 h-6 text-indigo-600 animate-pulse" />
              ) : (
                <div className="text-red-600">
                  <YouTubeIcon className="w-6 h-6" />
                </div>
              )}
            </div>

            <input
              aria-label="YouTube video or playlist URL"
              {...register("url")}
              type="text"
              placeholder="Paste YouTube Video or Playlist URL..."
              className="w-full min-w-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none text-sm sm:text-base font-medium truncate"
              disabled={isPending}
              autoComplete="off"
              spellCheck="false"
            />

          </div>

          {/* Submit CTA Button */}
          <button
            type="submit"
            disabled={isPending}
            className="flex-shrink-0 w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-all duration-200 disabled:opacity-60 shadow-md shadow-blue-500/20 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 group"
          >
            {isPending ? (
              <>
                <BrandLoader size="xs" tone="inverse" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{isPlaylist ? "Extract Playlist" : "Open Workspace"}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
