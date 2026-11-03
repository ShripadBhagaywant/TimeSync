package com.timesync.notes.exception;

import org.springframework.http.HttpStatus;

public class UpstreamRateLimitException extends ApiException {
    private final long retryAfterSeconds;
    private final com.timesync.notes.integration.youtube.YoutubeContentOperation operation;

    public UpstreamRateLimitException(String message) {
        this(message, 1);
    }

    public UpstreamRateLimitException(String message, long retryAfterSeconds) {
        this(message, retryAfterSeconds, null);
    }

    public UpstreamRateLimitException(String message, long retryAfterSeconds,
            com.timesync.notes.integration.youtube.YoutubeContentOperation operation) {
        super(message, HttpStatus.TOO_MANY_REQUESTS, "YOUTUBE_RATE_LIMITED");
        this.operation = operation;
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    @com.fasterxml.jackson.annotation.JsonIgnore
    public com.timesync.notes.integration.youtube.YoutubeContentOperation getOperation() {
        return operation;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
