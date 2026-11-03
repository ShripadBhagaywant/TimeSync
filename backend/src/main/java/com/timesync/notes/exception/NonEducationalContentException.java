package com.timesync.notes.exception;

import org.springframework.http.HttpStatus;

public class NonEducationalContentException extends ApiException{
    private final com.timesync.notes.guardrail.ContentPolicyDecision decision;

    public NonEducationalContentException(String message) {
        super(message,HttpStatus.UNPROCESSABLE_ENTITY,"NON_EDUCATIONAL_CONTENT");
        this.decision = null;
    }
    public NonEducationalContentException(com.timesync.notes.guardrail.ContentPolicyDecision decision) {
        super(decision.reason(), HttpStatus.UNPROCESSABLE_ENTITY, "NON_EDUCATIONAL_CONTENT");
        this.decision = decision;
    }
    public com.timesync.notes.guardrail.ContentPolicyDecision getDecision() { return decision; }
}
