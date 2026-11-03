package com.timesync.notes.entity;

public enum AiProcessingStatus {
    NOT_REQUESTED,
    QUEUED,
    PROCESSING,
    COMPLETED,
    FAILED,
    SKIPPED_QUOTA,
    SKIPPED_UNAVAILABLE,
    NOT_APPLICABLE
}
