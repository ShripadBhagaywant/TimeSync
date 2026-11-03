package com.timesync.notes.dto.request;

import com.timesync.notes.dto.response.ChapterDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ImportTranscriptRequest(
        @NotBlank
        @Pattern(regexp = "^[a-zA-Z0-9_-]{11}$", message = "Invalid YouTube video ID")
        String videoId,
        @NotBlank(message = "Transcript text is required")
        @Size(max = 500_000, message = "Transcript is too large")
        String transcript,
        @Size(max = 500, message = "Too many chapters")
        List<ChapterDto> chapters,
        Boolean editableChapters
) {
}
