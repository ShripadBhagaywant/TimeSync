package com.timesync.notes.dto.response;

import com.timesync.notes.entity.AiProcessingStatus;

import java.time.Instant;

public record AiNoteJobResponse(
        String jobId,
        AiProcessingStatus status,
        String message,
        TranscriptResponse result,
        Integer retryAfterSeconds,
        Instant createdAt,
        Instant updatedAt
) {
}
