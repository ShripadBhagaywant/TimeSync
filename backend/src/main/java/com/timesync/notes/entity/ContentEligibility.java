package com.timesync.notes.entity;

public enum ContentEligibility {

    EDUCATIONAL,
    INFORMATIONAL,
    ENTERTAINMENT,
    UNKNOWN;

    public boolean isAllowed() {
        return this == EDUCATIONAL || this == INFORMATIONAL;
    }

    public boolean isRejected() {
        return !isAllowed();
    }
}