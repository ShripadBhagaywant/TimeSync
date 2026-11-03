import { describe, expect, it } from "vitest";
import {
  classifyYouTubeInput,
  extractYouTubePlaylistId,
  extractYouTubeVideoId,
} from "@/features/extraction/utils/youtubeUrl";

const videoId = "dQw4w9WgXcQ";
const playlistId = "PL12345678901234567890";

describe("YouTube URL filters", () => {
  it("accepts standard, short, shorts, live, embed, and mobile video URLs", () => {
    expect(extractYouTubeVideoId(videoId)).toBe(videoId);
    expect(extractYouTubeVideoId("https://youtu.be/" + videoId)).toBe(videoId);
    expect(
      extractYouTubeVideoId("https://youtube.com/shorts/" + videoId),
    ).toBe(videoId);
    expect(
      extractYouTubeVideoId("https://m.youtube.com/live/" + videoId),
    ).toBe(videoId);
    expect(
      extractYouTubeVideoId(
        "https://www.youtube-nocookie.com/embed/" + videoId,
      ),
    ).toBe(videoId);
  });

  it("prioritizes a playlist when a watch URL contains both IDs", () => {
    const input =
      "https://youtube.com/watch?v=" + videoId + "&list=" + playlistId;
    expect(extractYouTubePlaylistId(input)).toBe(playlistId);
    expect(classifyYouTubeInput(input)).toBe("playlist");
  });

  it("rejects non-YouTube hosts and malformed IDs", () => {
    expect(
      extractYouTubeVideoId("https://example.com/watch?v=" + videoId),
    ).toBeNull();
    expect(extractYouTubeVideoId("https://youtube.com/watch?v=bad")).toBeNull();
  });
});
