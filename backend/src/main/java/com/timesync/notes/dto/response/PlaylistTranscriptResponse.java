package com.timesync.notes.dto.response;

import lombok.Builder;

import java.util.List;

@Builder
public record PlaylistTranscriptResponse(
        String playlistId,
        String playlistTitle,
        String playlistThumbnailUrl,
        int totalVideos,
        int attemptedVideos,
        int processedVideos,
        int captionVideos,
        int metadataVideos,
        int temporarilyUnavailableVideos,
        int failedVideos,
        int skippedVideos,
        List<TranscriptResponse> videoNotes,
        List<PlaylistItemFailure> failures,
        boolean truncated,
        boolean stoppedEarly,
        int maxVideos,
        boolean cachedResponse
) {
}
