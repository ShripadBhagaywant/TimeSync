// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { VideoInfoPanel } from "@/features/workspace/components/info/VideoInfoPanel";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
const video = { videoId: "one", title: "Lesson", content: "Imported evidence", noteSource: "USER_PROVIDED", transcriptLanguage: "und", aiStatus: "NOT_REQUESTED", verificationLevel: "UNVERIFIED", chapters: [], transcriptSegments: [] } as unknown as TranscriptResponse;
beforeEach(() => { useWorkspaceStore.getState().resetWorkspace(); useWorkspaceStore.setState({ videoPreferences: {} }); useWorkspaceStore.getState().setActiveVideo(video); });
afterEach(cleanup);
it("separates parsed source readiness from AI verification", () => {
  render(<VideoInfoPanel />);
  expect(screen.getByText("Ready")).toBeTruthy();
  expect(screen.getByText("Not verified")).toBeTruthy();
  expect(screen.getByText("Not requested")).toBeTruthy();
  expect(screen.getByText("Not identified")).toBeTruthy();
});
it("shows the current selected output language before AI starts", () => {
  useWorkspaceStore.setState({ videoPreferences: { one: { isStarred: false, targetLanguage: "Hindi" } } });
  render(<VideoInfoPanel />);
  expect(screen.getByText("Hindi")).toBeTruthy();
});
it("shows verified evidence separately from interrupted AI generation", () => {
  useWorkspaceStore.getState().setActiveVideo({ ...video, aiStatus: "FAILED", verificationLevel: "SEMANTIC_VERIFIED", contentEligibility: "EDUCATIONAL" });
  render(<VideoInfoPanel />);
  expect(screen.getByText("Verified for educational notes")).toBeTruthy();
  expect(screen.getByText("Draft interrupted")).toBeTruthy();
});
