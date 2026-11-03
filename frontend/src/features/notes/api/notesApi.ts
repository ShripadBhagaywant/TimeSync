import { apiClient } from "@/lib/axios";
import type { CleaningStage } from "@/features/extraction/types/extraction.types";

export interface ShareNoteRequest {
  videoId: string;
  videoTitle: string;
  noteContent: string;
  cleaningStage: CleaningStage;
}

export interface SharedNoteResponse {
  hashId: string;
  shareUrl: string;
  videoId: string;
  videoTitle: string;
  noteContent: string;
  cleaningStage: CleaningStage;
  createdAt: string;
  expiresAt: string;
}

export const notesApi = {
  createSnapshot: async (
    payload: ShareNoteRequest,
  ): Promise<SharedNoteResponse> => {
    const { data } = await apiClient.post<SharedNoteResponse>(
      "/notes/share",
      payload,
    );
    return data;
  },

  getSnapshot: async (hashId: string): Promise<SharedNoteResponse> => {
    const { data } = await apiClient.get<SharedNoteResponse>(
      `/notes/${encodeURIComponent(hashId)}`,
    );
    return data;
  },
};
