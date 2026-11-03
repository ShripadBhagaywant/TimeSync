import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "react-router-dom";
import { extractionApi } from "@/features/extraction/api/extractionApi";
import type { PlaylistTranscriptResponse, TranscriptResponse } from "@/features/extraction/types/extraction.types";
import { savePlaylistWorkspace, saveVideoWorkspace } from "@/lib/indexDB";
import { useWorkspaceStore } from "../store/workspaceStore";
import type { PlaylistNoteDocument } from "../types/workspace.types";
import { chapterAuthority } from "../utils/chapterAuthority";
import { reconcileTranscript } from "@/features/extraction/utils/transcriptReconciliation";
import { restoreLocalPlaylist, restoreLocalVideo, restorePlaylist, restoreVideo, type WorkspaceData } from "../utils/workspaceRestoration";

interface WorkspaceRouteState {
  transcriptData?: TranscriptResponse;
  playlistData?: PlaylistTranscriptResponse;
}

const storageWarning = () => console.warn("Workspace persistence unavailable; continuing without local storage.");

export const useWorkspaceData = () => {
  const { videoId, playlistId, playlistVideoId } = useParams<{ videoId?: string; playlistId?: string; playlistVideoId?: string }>();
  const location = useLocation();
  const route = (location.state as WorkspaceRouteState | null) ?? null;
  const activeVideo = useWorkspaceStore((state) => state.activeVideo);
  const playlistData = useWorkspaceStore((state) => state.playlistData);

  // One shared initialization promise also covers StrictMode's effect replay.
  // Local reads are inside the query, so the network cannot race hydration.
  const query = useQuery({
    queryKey: ["workspace-initialization", playlistId ?? null, videoId ?? null],
    enabled: Boolean(playlistId || videoId),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      let data: WorkspaceData | null = null;
      let selectedVideoId = playlistVideoId;
      let document: PlaylistNoteDocument | undefined;
      let hydration: "restored" | "not-found" | "failed" = "not-found";
      if (playlistId) {
        const local = await restoreLocalPlaylist(playlistId, playlistVideoId).catch(() => {
          hydration = "failed"; storageWarning(); return null;
        });
        const current = useWorkspaceStore.getState();
        const fresh = restorePlaylist(current.playlistData, playlistId) ?? restorePlaylist(route?.playlistData, playlistId);
        const base = fresh ?? local?.playlist;
        const savedVideos = new Map(local?.playlist.videoNotes.map(video => [video.videoId, video]));
        data = base ? { ...base, videoNotes: base.videoNotes.map((video) =>
          reconcileTranscript(savedVideos.get(video.videoId), video)!) } : null;
        document = local?.document;
        selectedVideoId ??= local?.activeVideoId;
      } else if (videoId) {
        const local = await restoreLocalVideo(videoId).catch(() => {
          hydration = "failed"; storageWarning(); return null;
        });
        const current = useWorkspaceStore.getState();
        data = reconcileTranscript(local, reconcileTranscript(restoreVideo(current.activeVideo, videoId), restoreVideo(route?.transcriptData, videoId)));
      }
      if (data) hydration = "restored";
      else if (playlistId) {
        data = await extractionApi.getPlaylist(playlistId);
        data.videoNotes.forEach((video) => useWorkspaceStore.getState().recordChapterResponse(video));
      } else if (videoId) {
        data = await extractionApi.getVideo(videoId);
        useWorkspaceStore.getState().recordChapterResponse(data);
      }
      if (data) {
        data = "videoNotes" in data ? chapterAuthority.applyPlaylist(data) : chapterAuthority.apply(data);
      }
      return { data, hydration, selectedVideoId, document };
    },
  });

  const applied = useRef<{ result: typeof query.data; selection?: string } | null>(null);
  useEffect(() => {
    const result = query.data;
    const state = useWorkspaceStore.getState();
    if (!playlistId && !videoId) {
      state.setActiveVideo(null);
      state.setPlaylistData(null);
      return;
    }
    if (!result?.data) {
      if ((playlistId && state.playlistData?.playlistId !== playlistId) || (videoId && state.activeVideo?.videoId !== videoId)) {
        state.setActiveVideo(null);
        state.setPlaylistData(null);
      }
      return;
    }
    if (applied.current?.result === result && applied.current.selection === playlistVideoId) return;
    const previouslyApplied = applied.current?.result === result;
    applied.current = { result, selection: playlistVideoId };
    if ("videoNotes" in result.data) {
      const playlist = previouslyApplied && state.playlistData && state.playlistData.playlistId === playlistId ? state.playlistData : result.data;
      state.setPlaylistData(playlist);
      if (result.document && !previouslyApplied) state.hydratePlaylistNoteDocument(playlist.playlistId, result.document);
      const selected = playlistVideoId ?? result.selectedVideoId;
      state.setActiveVideo(playlist.videoNotes.find((video) => video.videoId === selected) ?? playlist.videoNotes[0] ?? null);
    } else {
      state.setPlaylistData(null);
      state.setActiveVideo(result.data);
    }
  }, [query.data, playlistId, videoId, playlistVideoId]);

  // Persist changes to source/AI context, while editor HTML retains its own store.
  useEffect(() => {
    if (!query.data || applied.current?.result !== query.data || !activeVideo) return;
    if (playlistId && playlistData?.playlistId === playlistId) {
      void savePlaylistWorkspace(playlistData, activeVideo.videoId).catch(storageWarning);
    } else if (videoId === activeVideo.videoId && !playlistId) {
      void saveVideoWorkspace(activeVideo).catch(storageWarning);
    }
  }, [query.data, activeVideo, playlistData, playlistId, videoId]);

  const isLoading = Boolean(playlistId || videoId) && query.isPending;
  const activeMatchesRoute = playlistId ? playlistData?.playlistId === playlistId
    && (!playlistVideoId || activeVideo?.videoId === playlistVideoId) : videoId === activeVideo?.videoId;
  return {
    videoData: activeMatchesRoute ? activeVideo : null,
    hydrationStatus: isLoading ? "hydrating" : query.isError ? "failed" : query.data?.hydration ?? "idle",
    isLoading, error: query.error, refetch: query.refetch,
  };
};
