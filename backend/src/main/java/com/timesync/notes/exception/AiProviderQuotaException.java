package com.timesync.notes.exception;

import org.springframework.http.HttpStatus;

public class AiProviderQuotaException extends ApiException {

    private final int retryAfterSeconds;

    public AiProviderQuotaException(String message, Throwable cause, int retryAfterSeconds) {
        super(message, cause, HttpStatus.TOO_MANY_REQUESTS, "AI_PROVIDER_QUOTA_EXCEEDED");
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    public int getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
