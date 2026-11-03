import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ChapterDto,
  TranscriptResponse,
  PlaylistTranscriptResponse,
} from "@/features/extraction/types/extraction.types";
import type { PlaylistNoteDocument } from "../types/workspace.types";
import { createPlaylistNoteDocument } from "../utils/playlistNoteDocument";
import { chapterAuthority } from "../utils/chapterAuthority";

interface VideoPreference {
  targetLanguage?: string;
  customTitle?: string;
  isStarred: boolean;
  customChapters?: ChapterDto[];
}

interface WorkspaceState {
  activeVideo: TranscriptResponse | null;
  playlistData: PlaylistTranscriptResponse | null;
  playlistNoteDocument: PlaylistNoteDocument | null;
  playlistDocumentHydrated: boolean;
  playlistDocumentDirty: boolean;
  pendingAiDrafts: Record<string, TranscriptResponse>;
  customTitle: string | null;
  isStarred: boolean;
  autoSaveEnabled: boolean;
  showTranscriptTimestamps: boolean;
  showShortcutPanel: boolean;
  isShortcutPanelOpen: boolean;
  videoPreferences: Record<string, VideoPreference>;
  currentTime: number;
  seekRequestedTime: number | null;
  isPlaylistSidebarOpen: boolean;
  setActiveVideo: (video: TranscriptResponse | null | undefined) => void;
  replaceVideoResponse: (video: TranscriptResponse) => void;
  recordChapterResponse: (video: TranscriptResponse) => void;
  setEditableChapters: (chapters: ChapterDto[]) => void;
  setPlaylistData: (playlist: PlaylistTranscriptResponse | null) => void;
  hydratePlaylistNoteDocument: (
    playlistId: string,
    document?: PlaylistNoteDocument,
  ) => void;
  setPlaylistNoteDocument: (document: PlaylistNoteDocument | null) => void;
  updatePlaylistDocumentContent: (content: string) => void;
  setPendingAiDraft: (videoId: string, draft: TranscriptResponse) => void;
  discardPendingAiDraft: (videoId: string) => void;
  setCustomTitle: (title: string | null) => void;
  toggleStarred: () => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setShowTranscriptTimestamps: (value: boolean) => void;
  setShowShortcutPanel: (value: boolean) => void;
  setIsShortcutPanelOpen: (open: boolean) => void;
  setCurrentTime: (time: number) => void;
  requestSeekTo: (seconds: number) => void;
  clearSeekRequest: () => void;
  togglePlaylistSidebar: () => void;
  resetWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeVideo: null,
      playlistData: null,
      playlistNoteDocument: null,
      playlistDocumentHydrated: false,
      playlistDocumentDirty: false,
      pendingAiDrafts: {},
      customTitle: null,
      isStarred: false,
      autoSaveEnabled: true,
      showTranscriptTimestamps: true,
      showShortcutPanel: true,
      isShortcutPanelOpen: false,
      videoPreferences: {},
      currentTime: 0,
      seekRequestedTime: null,
      isPlaylistSidebarOpen: true,

      setActiveVideo: (video) =>
        set((state) => {
          const incomingVideo = video ?? null;
          const preference = incomingVideo
            ? state.videoPreferences[incomingVideo.videoId]
            : undefined;
          const activeVideo = incomingVideo ? chapterAuthority.apply(incomingVideo) : null;
          const videoChanged =
            state.activeVideo?.videoId !== activeVideo?.videoId;

          return {
            activeVideo,
            customTitle: preference?.customTitle ?? null,
            isStarred: preference?.isStarred ?? false,
            currentTime: videoChanged ? 0 : state.currentTime,
            seekRequestedTime: videoChanged ? null : state.seekRequestedTime,
          };
        }),
      replaceVideoResponse: (video) =>
        set((state) => {
          const activeVideo = chapterAuthority.apply(video);
          return {
            activeVideo: state.activeVideo?.videoId === video.videoId ? activeVideo : state.activeVideo,
            playlistData: state.playlistData
              ? {
                  ...state.playlistData,
                  videoNotes: state.playlistData.videoNotes.map((item) =>
                    item.videoId === video.videoId ? activeVideo : item,
                  ),
                }
              : null,
          };
        }),
      recordChapterResponse: (video) => {
        chapterAuthority.remember(video);
        set((state) => ({
          activeVideo: state.activeVideo ? chapterAuthority.apply(state.activeVideo) : null,
          playlistData: state.playlistData ? chapterAuthority.applyPlaylist(state.playlistData) : null,
        }));
      },
      setEditableChapters: (chapters) =>
        set((state) => {
          const activeVideo = state.activeVideo;
          if (!activeVideo?.isEditableChapters) return {};

          const sortedChapters = [...chapters].sort(
            (left, right) =>
              left.startTimestampSeconds - right.startTimestampSeconds,
          );
          const previousPreference = state.videoPreferences[activeVideo.videoId] ?? {
            isStarred: false,
          };
          return {
            videoPreferences: {
              ...state.videoPreferences,
              [activeVideo.videoId]: {
                ...previousPreference,
                customChapters: sortedChapters,
              },
            },
          };
        }),
      setPlaylistData: (playlistData) =>
        set((state) => {
          if (!playlistData) {
            return {
              playlistData: null,
              playlistNoteDocument: null,
              playlistDocumentHydrated: false,
              playlistDocumentDirty: false,
            };
          }
          playlistData = chapterAuthority.applyPlaylist(playlistData);
          if (state.playlistNoteDocument?.playlistId === playlistData.playlistId) {
            return { playlistData };
          }
          return {
            playlistData,
            playlistNoteDocument: createPlaylistNoteDocument(
              playlistData.playlistId,
              playlistData.playlistTitle || "Playlist Notes",
            ),
            playlistDocumentHydrated: false,
            playlistDocumentDirty: false,
          };
        }),
      hydratePlaylistNoteDocument: (playlistId, document) =>
        set((state) => {
          if (state.playlistNoteDocument?.playlistId !== playlistId) return {};
          return {
            playlistNoteDocument:
              document && !state.playlistDocumentDirty
                ? document
                : state.playlistNoteDocument,
            playlistDocumentHydrated: true,
          };
        }),
      setPlaylistNoteDocument: (playlistNoteDocument) =>
        set({
          playlistNoteDocument,
          playlistDocumentHydrated: true,
          playlistDocumentDirty: true,
        }),
      updatePlaylistDocumentContent: (content) =>
        set((state) => {
          if (!state.playlistNoteDocument || state.playlistNoteDocument.content === content) {
            return {};
          }
          return {
            playlistNoteDocument: {
              ...state.playlistNoteDocument,
              content,
              sections: state.playlistNoteDocument.sections.filter((section) =>
                content.includes(`data-playlist-video-id="${section.videoId}"`),
              ),
              updatedAt: Date.now(),
            },
            playlistDocumentDirty: true,
          };
        }),
      setPendingAiDraft: (videoId, draft) =>
        set((state) => ({
          pendingAiDrafts: { ...state.pendingAiDrafts, [videoId]: draft },
          activeVideo: state.activeVideo?.videoId === videoId
            ? { ...state.activeVideo, aiStatus: "COMPLETED", aiJobId: null } : state.activeVideo,
          playlistData: state.playlistData ? { ...state.playlistData, videoNotes: state.playlistData.videoNotes.map(video =>
            video.videoId === videoId ? { ...video, aiStatus: "COMPLETED", aiJobId: null } : video) } : null,
        })),
      discardPendingAiDraft: (videoId) =>
        set((state) => {
          const pendingAiDrafts = { ...state.pendingAiDrafts };
          delete pendingAiDrafts[videoId];
          return { pendingAiDrafts };
        }),
      setCustomTitle: (customTitle) =>
        set((state) => {
          const videoId = state.activeVideo?.videoId;
          if (!videoId) return { customTitle };

          const previous = state.videoPreferences[videoId] ?? {
            isStarred: false,
          };
          const nextPreference: VideoPreference = {
            ...previous,
            isStarred: previous.isStarred,
          };
          if (customTitle) {
            nextPreference.customTitle = customTitle;
          } else {
            delete nextPreference.customTitle;
          }

          return {
            customTitle,
            videoPreferences: {
              ...state.videoPreferences,
              [videoId]: nextPreference,
            },
          };
        }),
      toggleStarred: () =>
        set((state) => {
          const isStarred = !state.isStarred;
          const videoId = state.activeVideo?.videoId;
          if (!videoId) return { isStarred };

          return {
            isStarred,
            videoPreferences: {
              ...state.videoPreferences,
              [videoId]: {
                ...state.videoPreferences[videoId],
                isStarred,
              },
            },
          };
        }),
      setAutoSaveEnabled: (autoSaveEnabled) => set({ autoSaveEnabled }),
      setShowTranscriptTimestamps: (showTranscriptTimestamps) =>
        set({ showTranscriptTimestamps }),
      setShowShortcutPanel: (showShortcutPanel) =>
        set((state) => ({
          showShortcutPanel,
          isShortcutPanelOpen: showShortcutPanel
            ? state.isShortcutPanelOpen
            : false,
        })),
      setIsShortcutPanelOpen: (isShortcutPanelOpen) =>
        set((state) => ({
          isShortcutPanelOpen:
            isShortcutPanelOpen && state.showShortcutPanel
              ? true
              : false,
        })),
      setCurrentTime: (currentTime) => set({ currentTime }),
      requestSeekTo: (seconds) =>
        set({ seekRequestedTime: Math.max(0, seconds) }),
      clearSeekRequest: () => set({ seekRequestedTime: null }),
      togglePlaylistSidebar: () =>
        set((state) => ({
          isPlaylistSidebarOpen: !state.isPlaylistSidebarOpen,
        })),
      resetWorkspace: () =>
        set({
          activeVideo: null,
          playlistData: null,
          playlistNoteDocument: null,
          playlistDocumentHydrated: false,
          playlistDocumentDirty: false,
          pendingAiDrafts: {},
          customTitle: null,
          isStarred: false,
          currentTime: 0,
          seekRequestedTime: null,
          isPlaylistSidebarOpen: true,
          isShortcutPanelOpen: false,
        }),
    }),
    {
      name: "timesync-workspace-preferences-v2",
      partialize: (state) => ({
        videoPreferences: state.videoPreferences,
        autoSaveEnabled: state.autoSaveEnabled,
        showTranscriptTimestamps: state.showTranscriptTimestamps,
        showShortcutPanel: state.showShortcutPanel,
      }),
    },
  ),
);
