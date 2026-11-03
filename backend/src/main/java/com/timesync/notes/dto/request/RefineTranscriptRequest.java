package com.timesync.notes.dto.request;

import com.timesync.notes.dto.response.ChapterDto;
import com.timesync.notes.dto.response.TranscriptSegmentDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record RefineTranscriptRequest(
        @NotBlank
        @Pattern(regexp = "^[a-zA-Z0-9_-]{11}$", message = "Invalid YouTube video ID")
        String videoId,
        @NotBlank(message = "Transcript text is required")
        @Size(max = 500_000, message = "Transcript is too large")
        String transcript,
        @Size(max = 100_000, message = "Too many transcript segments")
        List<TranscriptSegmentDto> transcriptSegments,
        @Size(max = 30, message = "Transcript language is too long")
        String transcriptLanguage,
        @Size(max = 500, message = "Too many chapters")
        List<ChapterDto> chapters,
        Boolean editableChapters,
        @NotBlank(message = "Target language is required")
        @Size(max = 50, message = "Target language is too long")
        String targetLanguage
) {
    public RefineTranscriptRequest {
        targetLanguage = targetLanguage == null || targetLanguage.isBlank() ? "English" : targetLanguage.trim();
    }
}
