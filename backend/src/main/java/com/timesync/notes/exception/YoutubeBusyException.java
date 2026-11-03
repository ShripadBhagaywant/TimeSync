package com.timesync.notes.exception;

import org.springframework.http.HttpStatus;

public class YoutubeBusyException extends ApiException {
    public YoutubeBusyException(String message) {
        super(message, HttpStatus.SERVICE_UNAVAILABLE, "YOUTUBE_BUSY");
    }
}