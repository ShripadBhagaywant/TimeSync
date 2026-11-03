import { getTranscriptSource } from "@/lib/indexDB";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";

export interface RestoreOriginalDraftActions {
  saveSource?: (response: TranscriptResponse) => Promise<void>;
  isCurrent?: () => boolean;
  deleteDraft: (videoId: string) => Promise<void>;
  replaceVideoResponse: (response: TranscriptResponse) => void;
  discardPendingAiDraft: (videoId: string) => void;
  remountSingleVideoEditor: () => void;
}

export const restoreOriginalDraft = async (
  videoId: string,
  isPlaylist: boolean,
  actions: RestoreOriginalDraftActions,
): Promise<boolean> => {
  const savedSource = await getTranscriptSource(videoId);
  if (!savedSource?.response || actions.isCurrent?.() === false) return false;

  const source = savedSource.originalResponse ?? savedSource.response;
  await actions.saveSource?.(source);
  if (actions.isCurrent?.() === false) return false;
  await actions.deleteDraft(videoId);
  if (actions.isCurrent?.() === false) return false;
  actions.replaceVideoResponse(source);
  actions.discardPendingAiDraft(videoId);
  if (!isPlaylist) actions.remountSingleVideoEditor();
  return true;
};
