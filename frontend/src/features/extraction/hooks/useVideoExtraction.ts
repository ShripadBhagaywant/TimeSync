// features/extraction/hooks/useVideoExtraction.ts
import { useMutation } from "@tanstack/react-query";
import { extractionApi } from "../api/extractionApi";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
import {
  ExtractVideoRequest,
  ExtractPlaylistRequest,
  TranscriptResponse,
  PlaylistTranscriptResponse,
} from "../types/extraction.types";

export const useVideoExtraction = () => {
  return useMutation<TranscriptResponse, Error, ExtractVideoRequest>({
    mutationFn: extractionApi.extractVideo,
    onSuccess: (video) => useWorkspaceStore.getState().recordChapterResponse(video),
    retry: false,
  });
};

export const usePlaylistExtraction = () => {
  return useMutation<PlaylistTranscriptResponse, Error, ExtractPlaylistRequest>(
    {
      mutationFn: extractionApi.extractPlaylist,
      onSuccess: (playlist) => playlist.videoNotes.forEach((video) => useWorkspaceStore.getState().recordChapterResponse(video)),
      retry: false,
    },
  );
};
