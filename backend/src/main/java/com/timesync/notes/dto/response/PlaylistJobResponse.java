package com.timesync.notes.dto.response;

import java.time.Instant;

public record PlaylistJobResponse(
        String jobId,
        String traceId,
        String status,
        String message,
        PlaylistTranscriptResponse result,
        String errorCode,
        String errorMessage,
        Instant createdAt,
        Instant updatedAt
) {
}
