package com.timesync.notes.exception;

import org.springframework.http.HttpStatus;

public class UpstreamServiceUnavailableException extends ApiException {

    public UpstreamServiceUnavailableException(String message, Throwable cause, String errorCode) {
        super(message, cause, HttpStatus.BAD_GATEWAY, errorCode);
    }

    public UpstreamServiceUnavailableException(String message, Throwable cause) {
        super(message, cause, HttpStatus.BAD_GATEWAY, "UPSTREAM_SERVICE_UNAVAILABLE");
    }
}
