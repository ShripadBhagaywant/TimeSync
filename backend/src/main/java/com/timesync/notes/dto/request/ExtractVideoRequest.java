package com.timesync.notes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ExtractVideoRequest(
        @NotBlank(message = "YouTube URL or Video ID is required")
        @Size(max = 2048, message = "YouTube URL is too long")
        String url
) {
    public ExtractVideoRequest(String url, String ignoredTargetLanguage, boolean ignoredAiRefinement) {
        this(url);
    }
}
