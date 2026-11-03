package com.timesync.notes.exception;

import org.springframework.http.HttpStatus;

public class AiProviderUnavailableException extends ApiException {

    private final int retryAfterSeconds;

    public AiProviderUnavailableException(String message, Throwable cause, int retryAfterSeconds) {
        super(message, cause, HttpStatus.SERVICE_UNAVAILABLE, "AI_PROVIDER_UNAVAILABLE");
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    public int getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
