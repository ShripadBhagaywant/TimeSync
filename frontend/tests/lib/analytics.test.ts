// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeAnalyticsEvent } from "@/lib/analytics";

describe("Vercel analytics URL privacy", () => {
  it("replaces video, playlist, and shared-note identifiers with route templates", () => {
    expect(sanitizeAnalyticsEvent({ type: "pageview", url: "https://time-sync-seven.vercel.app/workspace/video/abc123" })?.url)
      .toBe("https://time-sync-seven.vercel.app/workspace/video/:videoId");
    expect(sanitizeAnalyticsEvent({ type: "pageview", url: "https://time-sync-seven.vercel.app/workspace/playlist/private-id/video/video-id" })?.url)
      .toBe("https://time-sync-seven.vercel.app/workspace/playlist/:playlistId/video/:videoId");
    expect(sanitizeAnalyticsEvent({ type: "pageview", url: "https://time-sync-seven.vercel.app/notes/secret-hash" })?.url)
      .toBe("https://time-sync-seven.vercel.app/notes/:hashId");
  });

  it("removes query strings and hashes, and collapses unknown routes", () => {
    expect(sanitizeAnalyticsEvent({ type: "pageview", url: "https://time-sync-seven.vercel.app/guide?token=secret#section" })?.url)
      .toBe("https://time-sync-seven.vercel.app/guide");
    expect(sanitizeAnalyticsEvent({ type: "pageview", url: "https://time-sync-seven.vercel.app/private/user-id" })?.url)
      .toBe("https://time-sync-seven.vercel.app/other");
  });
});
