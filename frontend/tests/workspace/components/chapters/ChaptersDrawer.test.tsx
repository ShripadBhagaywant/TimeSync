// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChaptersDrawer } from "@/features/workspace/components/chapters/ChaptersDrawer";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
import type { TranscriptResponse, PlaylistTranscriptResponse } from "@/features/extraction/types/extraction.types";

const video = (editable: boolean): TranscriptResponse => ({
  videoId: "abcdefghijk", title: "Lesson", channelName: "Teacher", thumbnailUrl: "",
  content: "Transcript", transcriptSegments: [], duration: "10:00", cleanedTranscript: "",
  cleaningStage: "REGEX_SANITIZED", noteSource: "CAPTIONS", chapters: [],
  isEditableChapters: editable, cachedResponse: false,
});

describe("optional chapters", () => {
  it("does not display native-looking legacy chapters during temporary unavailability", () => {
    const stale = { ...video(true), chapterAvailability: "TEMPORARILY_UNAVAILABLE" as const,
      chapters: [{ title: "Stale snapshot chapter", startTimestampSeconds: 0, formattedTimestamp: "00:00" }] };
    useWorkspaceStore.getState().setActiveVideo(stale);
    render(<ChaptersDrawer />);
    expect(screen.queryByText("Stale snapshot chapter")).toBeNull();
    expect(screen.getByText("Chapters temporarily unavailable")).toBeTruthy();
    expect(useWorkspaceStore.getState().activeVideo?.chapters).toEqual(stale.chapters);
  });
  beforeEach(() => {
    localStorage.clear();
    useWorkspaceStore.setState({activeVideo: null, playlistData: null, videoPreferences: {}, currentTime: 42});
  });
  afterEach(cleanup);

  it("allows adding and removing markers when chapters are empty and editable", () => {
    useWorkspaceStore.getState().setActiveVideo(video(true));
    useWorkspaceStore.setState({currentTime: 42});
    render(<ChaptersDrawer />);
    expect(screen.getByText("No chapters found.")).toBeTruthy();
    expect(screen.getByText("Play the video and add your own chapter markers.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name: "Add chapter"}));
    fireEvent.change(screen.getByLabelText("Chapter Title"), {target: {value: "My marker"}});
    fireEvent.click(screen.getByRole("button", {name: "Save Chapter"}));
    expect(screen.getByText("My marker")).toBeTruthy();
    expect(useWorkspaceStore.getState().videoPreferences.abcdefghijk?.customChapters?.[0]?.startTimestampSeconds).toBe(42);
    expect(useWorkspaceStore.getState().activeVideo?.chapters).toEqual([]);
    fireEvent.click(screen.getByRole("button", {name: "Edit chapters"}));
    fireEvent.click(screen.getByRole("button", {name: "Remove chapter My marker"}));
    expect(screen.getByText("No chapters found.")).toBeTruthy();
    expect(useWorkspaceStore.getState().videoPreferences.abcdefghijk?.customChapters).toEqual([]);
  });

  it("keeps creator chapters read-only", () => {
    useWorkspaceStore.getState().setActiveVideo({...video(false), chapterAvailability: "AVAILABLE", chapters: [
      {title: "Creator chapter", startTimestampSeconds: 0, formattedTimestamp: "00:00"},
    ]});
    render(<ChaptersDrawer />);
    expect(screen.getByText("Creator chapter")).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Add chapter"})).toBeNull();
    expect(screen.queryByRole("button", {name: /Remove chapter/})).toBeNull();
    expect(screen.getByText("Locked")).toBeTruthy();
  });

  it("restores custom markers through the existing persisted preferences", async () => {
    const source = video(true);
    useWorkspaceStore.getState().setActiveVideo(source);
    useWorkspaceStore.getState().setEditableChapters([
      {title: "Saved marker", startTimestampSeconds: 42, formattedTimestamp: "00:42"},
    ]);
    const persisted = localStorage.getItem("timesync-workspace-preferences-v2");
    expect(persisted).toContain("Saved marker");
    useWorkspaceStore.setState({activeVideo: null, videoPreferences: {}});
    localStorage.setItem("timesync-workspace-preferences-v2", persisted!);
    await act(async () => { await useWorkspaceStore.persist.rehydrate(); });
    useWorkspaceStore.getState().setActiveVideo(source);
    render(<ChaptersDrawer />);
    expect(screen.getByText("Saved marker")).toBeTruthy();
  });
  it("shows genuine absence for NONE", () => {
    useWorkspaceStore.getState().setActiveVideo({ ...video(true), chapterAvailability: "NONE" });
    render(<ChaptersDrawer />);
    expect(screen.getByText("No chapters found.")).toBeTruthy();
    expect(screen.queryByText("Chapters temporarily unavailable")).toBeNull();
  });

  it.each([true, false])("shows temporary availability while preserving editable=%s", (editable) => {
    useWorkspaceStore.getState().setActiveVideo({ ...video(editable), chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
    render(<ChaptersDrawer />);
    expect(screen.getByText("Chapters temporarily unavailable")).toBeTruthy();
    expect(screen.getByText("TimeSync couldn't retrieve chapter data right now.")).toBeTruthy();
    expect(screen.queryByText(/No chapters (found|available)/)).toBeNull();
    expect(!!screen.queryByRole("button", { name: "Add chapter" })).toBe(editable);
  });

  it("keeps manual add/remove available during temporary retrieval failure", () => {
    useWorkspaceStore.getState().setActiveVideo({ ...video(true), chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
    render(<ChaptersDrawer />);
    fireEvent.click(screen.getByRole("button", { name: "Add chapter" }));
    fireEvent.change(screen.getByLabelText("Chapter Title"), { target: { value: "Custom marker" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Chapter" }));
    expect(screen.getByText("Custom marker")).toBeTruthy();
    expect(screen.getByText("Native chapters temporarily unavailable. Showing your saved chapter markers.")).toBeTruthy();
    expect(screen.queryByText("Chapters temporarily unavailable")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Search chapters..."), { target: { value: "missing" } });
    expect(screen.getByText("No matching chapters.")).toBeTruthy();
    expect(screen.queryByText("Chapters temporarily unavailable")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Search chapters..."), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit chapters" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove chapter Custom marker" }));
    expect(screen.getByText("Chapters temporarily unavailable")).toBeTruthy();
    expect(useWorkspaceStore.getState().activeVideo?.chapterAvailability).toBe("TEMPORARILY_UNAVAILABLE");
  });

  it("uses only the active playlist video's availability", () => {
    const temporary: TranscriptResponse = { ...video(true), chapterAvailability: "TEMPORARILY_UNAVAILABLE" };
    const none: TranscriptResponse = { ...video(true), videoId: "second", chapterAvailability: "NONE" };
    useWorkspaceStore.getState().setPlaylistData({
      playlistId: "course", playlistTitle: "Course", videoNotes: [temporary, none],
    } as PlaylistTranscriptResponse);
    useWorkspaceStore.getState().setActiveVideo(temporary);
    render(<ChaptersDrawer />);
    expect(screen.getByText("Chapters temporarily unavailable")).toBeTruthy();
    act(() => useWorkspaceStore.getState().setActiveVideo(none));
    expect(screen.getByText("No chapters found.")).toBeTruthy();
    expect(screen.queryByText("Chapters temporarily unavailable")).toBeNull();
    act(() => useWorkspaceStore.getState().setActiveVideo(temporary));
    expect(screen.getByText("Chapters temporarily unavailable")).toBeTruthy();
  });

  it.each(["NONE", "TEMPORARILY_UNAVAILABLE"] as const)("labels restored custom markers for %s", (chapterAvailability) => {
    useWorkspaceStore.setState({ videoPreferences: { abcdefghijk: { isStarred: false, customChapters: [
      { title: "My saved chapter", startTimestampSeconds: 4, formattedTimestamp: "00:04" },
    ] } } });
    useWorkspaceStore.getState().setActiveVideo({ ...video(true), chapterAvailability });
    render(<ChaptersDrawer />);
    expect(screen.getByText("My saved chapter")).toBeTruthy();
    expect(screen.getByText(chapterAvailability === "NONE"
      ? "Showing your saved chapter markers."
      : "Native chapters temporarily unavailable. Showing your saved chapter markers.")).toBeTruthy();
    expect(screen.queryByText(/No chapters (found|available)/)).toBeNull();
    expect(useWorkspaceStore.getState().activeVideo?.chapters).toEqual([]);
  });

  it("shows later native chapters instead of saved custom markers without deleting preferences", () => {
    const saved = [{ title: "Saved marker", startTimestampSeconds: 4, formattedTimestamp: "00:04" }];
    useWorkspaceStore.setState({ videoPreferences: { abcdefghijk: { isStarred: false, customChapters: saved } } });
    useWorkspaceStore.getState().setActiveVideo({ ...video(true), chapterAvailability: "TEMPORARILY_UNAVAILABLE" });
    render(<ChaptersDrawer />);
    expect(screen.getByText("Saved marker")).toBeTruthy();
    act(() => useWorkspaceStore.getState().replaceVideoResponse({
      ...video(false), chapterAvailability: "AVAILABLE",
      chapters: [{ title: "Native chapter", startTimestampSeconds: 0, formattedTimestamp: "00:00" }],
    }));
    expect(screen.getByText("Native chapter")).toBeTruthy();
    expect(screen.queryByText("Saved marker")).toBeNull();
    expect(screen.queryByText(/Native chapters temporarily unavailable/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove chapter/ })).toBeNull();
    expect(useWorkspaceStore.getState().videoPreferences.abcdefghijk?.customChapters).toEqual(saved);
  });

  it("keeps custom chapter provenance isolated while switching playlist videos", () => {
    const first: TranscriptResponse = { ...video(true), chapterAvailability: "TEMPORARILY_UNAVAILABLE" };
    const second: TranscriptResponse = { ...video(true), videoId: "second", chapterAvailability: "NONE" };
    useWorkspaceStore.getState().setPlaylistData({
      playlistId: "course", playlistTitle: "Course", videoNotes: [first, second],
    } as PlaylistTranscriptResponse);
    useWorkspaceStore.getState().setActiveVideo(first);
    useWorkspaceStore.getState().setEditableChapters([{ title: "First marker", startTimestampSeconds: 0, formattedTimestamp: "00:00" }]);
    render(<ChaptersDrawer />);
    expect(screen.getByText("First marker")).toBeTruthy();
    act(() => useWorkspaceStore.getState().setActiveVideo(second));
    expect(screen.queryByText("First marker")).toBeNull();
    expect(screen.getByText("No chapters found.")).toBeTruthy();
    act(() => useWorkspaceStore.getState().setActiveVideo(first));
    expect(screen.getByText("Native chapters temporarily unavailable. Showing your saved chapter markers.")).toBeTruthy();
    expect(useWorkspaceStore.getState().playlistData?.videoNotes.map(item => item.chapters)).toEqual([[], []]);
  });

  it("starts a new custom set without copying editable legacy source chapters", () => {
    const native = [{ title: "Legacy source chapter", startTimestampSeconds: 0, formattedTimestamp: "00:00" }];
    useWorkspaceStore.getState().setActiveVideo({ ...video(true), chapters: native });
    render(<ChaptersDrawer />);
    fireEvent.click(screen.getByRole("button", { name: "Add chapter" }));
    fireEvent.change(screen.getByLabelText("Chapter Title"), { target: { value: "Only my marker" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Chapter" }));
    expect(useWorkspaceStore.getState().videoPreferences.abcdefghijk?.customChapters?.map(item => item.title)).toEqual(["Only my marker"]);
    expect(useWorkspaceStore.getState().activeVideo?.chapters).toEqual(native);
    expect(screen.queryByText("Legacy source chapter")).toBeNull();
  });

});

it("exposes chapter seeking as a keyboard-accessible button", () => {
  const title = "A long chapter title that should remain readable in a narrow panel";
  useWorkspaceStore.getState().setActiveVideo({ ...video(false), chapterAvailability: "AVAILABLE", chapters: [
    { title, startTimestampSeconds: 90, formattedTimestamp: "01:30" },
  ] });
  render(<ChaptersDrawer />);
  const chapter = screen.getByRole("button", { name: new RegExp(title) });
  expect(chapter.getAttribute("type")).toBe("button");
  fireEvent.click(chapter);
  expect(useWorkspaceStore.getState().seekRequestedTime).toBe(90);
  cleanup();
});
