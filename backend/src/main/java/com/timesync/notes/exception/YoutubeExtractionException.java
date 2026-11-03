package com.timesync.notes.exception;

import org.springframework.http.HttpStatus;

public class YoutubeExtractionException extends ApiException{

    public YoutubeExtractionException(String message) {
        super(message, HttpStatus.BAD_REQUEST, "YOUTUBE_EXTRACTION_FAILED");
    }

    public YoutubeExtractionException(String message, Throwable cause) {
        super(message, cause, HttpStatus.BAD_REQUEST, "YOUTUBE_EXTRACTION_FAILED");
    }
}
