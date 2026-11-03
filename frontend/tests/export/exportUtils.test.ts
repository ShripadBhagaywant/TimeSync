import { htmlToMarkdown, htmlToPlainText } from "@/features/workspace/utils/exportConversions";
import { describe, expect, it, vi } from "vitest";
import {
  getLatestDraftContent,
} from "@/features/workspace/utils/exportUtils";

const getDraft = vi.hoisted(() => vi.fn());
vi.mock("@/lib/indexDB", () => ({ getDraft }));

describe("playlist export source", () => {
  it("exports live edits before the debounce writes them to storage", async () => {
    getDraft.mockResolvedValue({ content: "<p>Older saved notes</p>" });
    await expect(getLatestDraftContent("one", "<p>Newest edits</p>")).resolves.toBe("<p>Newest edits</p>");
    await expect(getLatestDraftContent("one", "")).resolves.toBe("");
    expect(getDraft).not.toHaveBeenCalled();
  });

  it("restores storage content when no editor snapshot is supplied", async () => {
    getDraft.mockResolvedValue({ content: "<p>Saved notes</p>" });
    await expect(getLatestDraftContent("one")).resolves.toBe("<p>Saved notes</p>");
  });
  it("uses the complete supplied playlist document instead of an active-video draft", async () => {
    const combined = "<h2>Video 1</h2><p>One</p><h2>Video 2</h2><p>Two</p>";
    await expect(getLatestDraftContent(undefined, combined)).resolves.toBe(combined);
  });

  it("keeps both ordered video sections in Markdown and text exports", () => {
    const combined = '<h2 data-playlist-video-id="video-1">Video 1</h2><p>One</p>' +
      '<h2 data-playlist-video-id="video-2">Video 2</h2><p>Two</p>';
    const markdown = htmlToMarkdown("Course", combined);
    const text = htmlToPlainText("Course", combined);

    expect(markdown.indexOf("Video 1")).toBeLessThan(markdown.indexOf("Video 2"));
    expect(markdown).toContain("One");
    expect(markdown).toContain("Two");
    expect(text).toContain("Video 1");
    expect(text).toContain("Video 2");
  });
});
