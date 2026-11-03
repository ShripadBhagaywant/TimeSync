import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
import { getTranscriptSource } from "@/lib/indexDB";
import {
  restoreOriginalDraft,
  type RestoreOriginalDraftActions,
} from "@/features/workspace/utils/restoreOriginalDraft";

vi.mock("@/lib/indexDB", () => ({
  getTranscriptSource: vi.fn(),
}));

const sourceResponse = {
  videoId: "video-1",
  content: "Original transcript",
} as TranscriptResponse;

const createActions = (): RestoreOriginalDraftActions => ({
  deleteDraft: vi.fn().mockResolvedValue(undefined),
  replaceVideoResponse: vi.fn(),
  discardPendingAiDraft: vi.fn(),
  remountSingleVideoEditor: vi.fn(),
});

describe("restoreOriginalDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces the video response and remounts a single-video editor", async () => {
    vi.mocked(getTranscriptSource).mockResolvedValue({
      videoId: sourceResponse.videoId,
      response: sourceResponse,
      updatedAt: Date.now(),
    });
    const actions = createActions();

    await expect(
      restoreOriginalDraft("video-1", false, actions),
    ).resolves.toBe(true);

    expect(actions.deleteDraft).toHaveBeenCalledWith("video-1");
    expect(actions.replaceVideoResponse).toHaveBeenCalledWith(sourceResponse);
    expect(actions.discardPendingAiDraft).toHaveBeenCalledWith("video-1");
    expect(actions.remountSingleVideoEditor).toHaveBeenCalledOnce();
  });

  it("returns false without changing state when the source is missing", async () => {
    vi.mocked(getTranscriptSource).mockResolvedValue(undefined);
    const actions = createActions();

    await expect(
      restoreOriginalDraft("video-1", false, actions),
    ).resolves.toBe(false);

    expect(actions.deleteDraft).not.toHaveBeenCalled();
    expect(actions.replaceVideoResponse).not.toHaveBeenCalled();
  });

  it("does not remount or overwrite the playlist master document", async () => {
    vi.mocked(getTranscriptSource).mockResolvedValue({
      videoId: sourceResponse.videoId,
      response: sourceResponse,
      updatedAt: Date.now(),
    });
    const actions = createActions();

    await restoreOriginalDraft("video-1", true, actions);

    expect(actions.replaceVideoResponse).toHaveBeenCalledWith(sourceResponse);
    expect(actions.remountSingleVideoEditor).not.toHaveBeenCalled();
  });
});

it("restores the original import rather than a saved generated response", async () => {
  vi.mocked(getTranscriptSource).mockResolvedValue({ videoId: "video-1", response: { ...sourceResponse, cleanedTranscript: "AI notes" }, originalResponse: sourceResponse, updatedAt: Date.now() });
  const actions = createActions();
  await restoreOriginalDraft("video-1", false, actions);
  expect(actions.replaceVideoResponse).toHaveBeenCalledWith(sourceResponse);
});
it("does not restore into another video after a slow storage read", async () => {
  vi.mocked(getTranscriptSource).mockResolvedValue({ videoId: "video-1", response: sourceResponse, updatedAt: Date.now() });
  const actions = { ...createActions(), isCurrent: () => false };
  await expect(restoreOriginalDraft("video-1", false, actions)).resolves.toBe(false);
  expect(actions.deleteDraft).not.toHaveBeenCalled();
  expect(actions.replaceVideoResponse).not.toHaveBeenCalled();
});
