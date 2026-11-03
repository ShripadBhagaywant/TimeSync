import { beforeEach, describe, expect, it } from "vitest";
import type { TranscriptResponse, PlaylistTranscriptResponse } from "@/features/extraction/types/extraction.types";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";

const video = (isEditableChapters: boolean): TranscriptResponse => ({
  videoId: "video-1",
  title: "Test video",
  channelName: "Test channel",
  thumbnailUrl: "",
  content: "",
  transcriptSegments: [],
  duration: "10:00",
  cleanedTranscript: "",
  cleaningStage: "METADATA_FALLBACK",
  noteSource: "METADATA",
  chapters: [],
  isEditableChapters,
  cachedResponse: false,
});

describe("workspace chapter preferences", () => {
  it("does not reset indented master content when the active video changes", () => {
    const content = '<h2>Video 1</h2><p data-indent="2">Manual notes</p><h2>Video 2</h2>';
    useWorkspaceStore.getState().setPlaylistNoteDocument({
      playlistId: "playlist-a", title: "Course", content, sections: [], createdAt: 1, updatedAt: 1,
    });
    useWorkspaceStore.getState().setActiveVideo(video(true));
    useWorkspaceStore.getState().setActiveVideo({ ...video(true), videoId: "video-2" });
    expect(useWorkspaceStore.getState().playlistNoteDocument?.content).toBe(content);
    useWorkspaceStore.getState().setActiveVideo(video(true));
    expect(useWorkspaceStore.getState().playlistNoteDocument?.content).toBe(content);
  });
  beforeEach(() => {
    useWorkspaceStore.setState({
      activeVideo: null,
      playlistData: null,
      playlistNoteDocument: null,
      playlistDocumentHydrated: false,
      playlistDocumentDirty: false,
      pendingAiDrafts: {},
      videoPreferences: {},
    });
  });

  it("keeps pending AI drafts keyed independently by video", () => {
    const first = { ...video(true), videoId: "video-1", title: "First" };
    const second = { ...video(true), videoId: "video-2", title: "Second" };

    useWorkspaceStore.getState().setPendingAiDraft(first.videoId, first);
    useWorkspaceStore.getState().setPendingAiDraft(second.videoId, second);

    expect(Object.keys(useWorkspaceStore.getState().pendingAiDrafts)).toEqual([
      "video-1",
      "video-2",
    ]);
    useWorkspaceStore.getState().discardPendingAiDraft(first.videoId);
    expect(useWorkspaceStore.getState().pendingAiDrafts["video-1"]).toBeUndefined();
    expect(useWorkspaceStore.getState().pendingAiDrafts["video-2"]?.title).toBe("Second");
  });

  it("restores user-created chapters when an editable video is loaded again", () => {
    const chapter = {
      title: "My chapter",
      startTimestampSeconds: 42,
      formattedTimestamp: "00:42",
    };

    useWorkspaceStore.getState().setActiveVideo(video(true));
    useWorkspaceStore.getState().setEditableChapters([chapter]);
    useWorkspaceStore.getState().setActiveVideo(null);
    useWorkspaceStore.getState().setActiveVideo(video(true));

    expect(useWorkspaceStore.getState().activeVideo?.chapters).toEqual([]);
    expect(
      useWorkspaceStore.getState().videoPreferences["video-1"]?.customChapters,
    ).toEqual([chapter]);
  });

  it("does not override locked native or AI chapters", () => {
    const nativeChapter = {
      title: "Native chapter",
      startTimestampSeconds: 0,
      formattedTimestamp: "00:00",
    };
    useWorkspaceStore.setState({
      videoPreferences: {
        "video-1": {
          isStarred: false,
          customChapters: [
            {
              title: "Old custom chapter",
              startTimestampSeconds: 5,
              formattedTimestamp: "00:05",
            },
          ],
        },
      },
    });

    useWorkspaceStore
      .getState()
      .setActiveVideo({ ...video(false), chapters: [nativeChapter] });

    expect(useWorkspaceStore.getState().activeVideo?.chapters).toEqual([
      nativeChapter,
    ]);
  });

  it("keeps title, star, and sorted editable chapters isolated per video", () => {
    useWorkspaceStore.getState().setActiveVideo(video(true));
    useWorkspaceStore.getState().setCustomTitle("My SQL notes");
    useWorkspaceStore.getState().toggleStarred();
    useWorkspaceStore.getState().setEditableChapters([
      { title: "Second", startTimestampSeconds: 20, formattedTimestamp: "00:20" },
      { title: "First", startTimestampSeconds: 0, formattedTimestamp: "00:00" },
    ]);

    const preference = useWorkspaceStore.getState().videoPreferences["video-1"];
    expect(preference?.customTitle).toBe("My SQL notes");
    expect(preference?.isStarred).toBe(true);
    expect(preference?.customChapters?.map((chapter) => chapter.title)).toEqual([
      "First",
      "Second",
    ]);

    useWorkspaceStore.getState().setActiveVideo(null);
    useWorkspaceStore.getState().setActiveVideo(video(true));
    expect(useWorkspaceStore.getState().customTitle).toBe("My SQL notes");
    expect(useWorkspaceStore.getState().isStarred).toBe(true);
  });
  it("keeps source chapters intact through edits and response replacement", () => {
    const source: TranscriptResponse = { ...video(true), chapterAvailability: "TEMPORARILY_UNAVAILABLE" };
    const custom = [{ title: "Saved marker", startTimestampSeconds: 3, formattedTimestamp: "00:03" }];
    const playlist = { playlistId: "course", playlistTitle: "Course", videoNotes: [source] } as PlaylistTranscriptResponse;
    useWorkspaceStore.getState().setPlaylistData(playlist);
    useWorkspaceStore.getState().setActiveVideo(source);
    useWorkspaceStore.getState().setEditableChapters(custom);
    expect(useWorkspaceStore.getState().activeVideo).toBe(source);
    expect(useWorkspaceStore.getState().playlistData).toBe(playlist);
    expect(source.chapters).toEqual([]);
    useWorkspaceStore.getState().replaceVideoResponse({ ...source, title: "Updated" });
    expect(useWorkspaceStore.getState().activeVideo?.chapters).toEqual([]);
    expect(useWorkspaceStore.getState().playlistData?.videoNotes[0]?.chapters).toEqual([]);
    expect(useWorkspaceStore.getState().videoPreferences[source.videoId]?.customChapters).toEqual(custom);
    const native: TranscriptResponse = { ...source, chapterAvailability: "AVAILABLE", isEditableChapters: false,
      chapters: [{ title: "Native", startTimestampSeconds: 0, formattedTimestamp: "00:00" }] };
    useWorkspaceStore.getState().replaceVideoResponse(native);
    expect(useWorkspaceStore.getState().activeVideo).toBe(native);
    expect(useWorkspaceStore.getState().playlistData?.videoNotes[0]).toBe(native);
    expect(useWorkspaceStore.getState().videoPreferences[source.videoId]?.customChapters).toEqual(custom);
  });

});

it("updates a background playlist response without switching the active video", () => {
  const first = video(true);
  const second = { ...first, videoId: "second" };
  useWorkspaceStore.getState().setActiveVideo(second);
  useWorkspaceStore.getState().replaceVideoResponse({ ...first, aiStatus: "COMPLETED" });
  expect(useWorkspaceStore.getState().activeVideo?.videoId).toBe("second");
});
it("keeps pending drafts when entering a single-video workspace", () => {
  const draft = video(true);
  useWorkspaceStore.getState().setPendingAiDraft(draft.videoId, draft);
  useWorkspaceStore.getState().setPlaylistData(null);
  expect(useWorkspaceStore.getState().pendingAiDrafts[draft.videoId]).toEqual(draft);
});
