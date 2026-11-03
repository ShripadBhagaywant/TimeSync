import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
import type {
  PlaylistNoteDocument,
  PlaylistNoteSection,
} from "../types/workspace.types";
import { markdownToEditorHtml } from "./markdownToEditorHtml";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sectionPattern = (videoId: string) =>
  new RegExp(
    `<h2\\b[^>]*data-playlist-video-id=["']${escapeRegExp(videoId)}["'][^>]*>[\\s\\S]*?(?=<h2\\b[^>]*data-playlist-video-id=["']|$)`,
    "i",
  );

const renderSection = (section: PlaylistNoteSection) =>
  `<h2 data-playlist-video-id="${escapeHtml(section.videoId)}">Video ${section.order + 1} — ${escapeHtml(section.videoTitle)}</h2>${section.content}`;

export const createPlaylistNoteDocument = (
  playlistId: string,
  title: string,
): PlaylistNoteDocument => {
  const now = Date.now();
  return {
    playlistId,
    title,
    content: "",
    sections: [],
    createdAt: now,
    updatedAt: now,
  };
};

export const hasPlaylistSection = (
  document: PlaylistNoteDocument | null,
  videoId: string,
) => Boolean(
  document?.sections.some((section) => section.videoId === videoId) &&
    sectionPattern(videoId).test(document.content),
);

export const upsertPlaylistAiSection = (
  document: PlaylistNoteDocument,
  draft: TranscriptResponse,
  order: number,
): PlaylistNoteDocument => {
  const now = Date.now();
  const existing = document.sections.find(
    (section) => section.videoId === draft.videoId,
  );
  const section: PlaylistNoteSection = {
    id: existing?.id ?? `video-${draft.videoId}`,
    videoId: draft.videoId,
    videoTitle: draft.title || "Untitled video",
    content: markdownToEditorHtml(
      draft.cleanedTranscript || draft.content || "",
    ),
    source: "AI",
    order,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const rendered = renderSection(section);
  let content = document.content;
  const existingPattern = sectionPattern(section.videoId);

  if (existingPattern.test(content)) {
    content = content.replace(existingPattern, rendered);
  } else {
    const nextSection = document.sections
      .filter((candidate) => candidate.order > order)
      .sort((left, right) => left.order - right.order)
      .find((candidate) => sectionPattern(candidate.videoId).test(content));
    if (nextSection) {
      const nextMarker = content.search(sectionPattern(nextSection.videoId));
      content = `${content.slice(0, nextMarker)}${rendered}${content.slice(nextMarker)}`;
    } else {
      content = `${content}${content.trim() ? "" : ""}${rendered}`;
    }
  }

  const sections = document.sections
    .filter((candidate) => candidate.videoId !== section.videoId)
    .concat(section)
    .sort((left, right) => left.order - right.order);

  return { ...document, content, sections, updatedAt: now };
};
