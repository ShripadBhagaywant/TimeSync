package com.timesync.notes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ExtractPlaylistRequest(
        @NotBlank(message = "YouTube Playlist URL or Playlist ID is required")
        @Size(max = 2048, message = "YouTube playlist URL is too long")
        String playlistUrl
) {
    public ExtractPlaylistRequest(String playlistUrl, String ignoredTargetLanguage, boolean ignoredAiRefinement) {
        this(playlistUrl);
    }
}
