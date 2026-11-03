package com.timesync.notes.exception;

import org.springframework.http.HttpStatus;

public class UnprocessableVideoException extends ApiException {

    public UnprocessableVideoException(String message, String errorCode) {
        super(message, HttpStatus.UNPROCESSABLE_ENTITY, errorCode);
    }
}