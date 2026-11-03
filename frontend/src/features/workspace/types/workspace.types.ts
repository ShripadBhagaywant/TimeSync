export type PlaylistNoteSource = "AI" | "MANUAL" | "TRANSCRIPT";

export interface PlaylistNoteSection {
  id: string;
  videoId: string;
  videoTitle: string;
  content: string;
  source: PlaylistNoteSource;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlaylistNoteDocument {
  playlistId: string;
  title: string;
  content: string;
  sections: PlaylistNoteSection[];
  createdAt: number;
  updatedAt: number;
}

