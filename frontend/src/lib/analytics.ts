import type { BeforeSendEvent } from "@vercel/analytics/react";

const staticRoutes = new Set(["/", "/guide", "/privacy", "/terms", "/workspace"]);

export const sanitizeAnalyticsEvent = (event: BeforeSendEvent): BeforeSendEvent | null => {
  try {
    const url = new URL(event.url, window.location.origin);
    const path = url.pathname;

    if (/^\/workspace\/video\/[^/]+\/?$/.test(path)) {
      url.pathname = "/workspace/video/:videoId";
    } else if (/^\/workspace\/playlist\/[^/]+\/video\/[^/]+\/?$/.test(path)) {
      url.pathname = "/workspace/playlist/:playlistId/video/:videoId";
    } else if (/^\/workspace\/playlist\/[^/]+\/?$/.test(path)) {
      url.pathname = "/workspace/playlist/:playlistId";
    } else if (/^\/notes\/[^/]+\/?$/.test(path)) {
      url.pathname = "/notes/:hashId";
    } else if (!staticRoutes.has(path)) {
      url.pathname = "/other";
    }

    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
};
