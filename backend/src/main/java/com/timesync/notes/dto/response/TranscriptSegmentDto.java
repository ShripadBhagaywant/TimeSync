package com.timesync.notes.dto.response;

public record TranscriptSegmentDto(
        double startSeconds,
        double durationSeconds,
        String text
) {
}
