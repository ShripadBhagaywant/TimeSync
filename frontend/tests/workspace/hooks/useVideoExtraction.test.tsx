// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { useVideoExtraction, usePlaylistExtraction } from "@/features/extraction/hooks/useVideoExtraction";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
import { chapterAuthority } from "@/features/workspace/utils/chapterAuthority";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";

const api = vi.hoisted(() => ({ extractVideo: vi.fn(), extractPlaylist: vi.fn() }));
vi.mock("@/features/extraction/api/extractionApi", () => ({ extractionApi: api }));
const fresh = { videoId: "fresh", chapters: [], chapterAvailability: "TEMPORARILY_UNAVAILABLE", isEditableChapters: true } as unknown as TranscriptResponse;
beforeEach(() => { chapterAuthority.clear(); useWorkspaceStore.getState().resetWorkspace(); vi.resetAllMocks(); });
afterEach(cleanup);

describe("extraction chapter provenance", () => {
  it("records fresh video chapters before the navigation callback runs", async () => {
    api.extractVideo.mockResolvedValue(fresh);
    const client = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(useVideoExtraction, { wrapper });
    const navigate = vi.fn(() => expect(chapterAuthority.apply({ ...fresh, chapters: [{ title: "Stale", startTimestampSeconds: 0, formattedTimestamp: "00:00" }] }).chapters).toEqual([]));
    await act(async () => { await result.current.mutateAsync({ url: "https://www.youtube.com/watch?v=fresh" }, { onSuccess: navigate }); });
    expect(navigate).toHaveBeenCalledOnce();
    client.clear();
  });
  it("records every playlist response and updates an open video immediately", async () => {
    useWorkspaceStore.getState().setActiveVideo({ ...fresh, chapters: [{ title: "Stale", startTimestampSeconds: 0, formattedTimestamp: "00:00" }] });
    api.extractPlaylist.mockResolvedValue({ videoNotes: [fresh, { ...fresh, videoId: "second" }] });
    const client = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(usePlaylistExtraction, { wrapper });
    await act(async () => { await result.current.mutateAsync({ playlistUrl: "https://www.youtube.com/playlist?list=course" }); });
    expect(useWorkspaceStore.getState().activeVideo?.chapters).toEqual([]);
    expect(chapterAuthority.apply({ ...fresh, videoId: "second", chapterAvailability: "AVAILABLE" }).chapterAvailability).toBe("TEMPORARILY_UNAVAILABLE");
    client.clear();
  });
});
