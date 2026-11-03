package com.timesync.notes.dto.response;


import com.timesync.notes.entity.ContentEligibility;

public record EducationalEvaluationResult(
        ContentEligibility eligibility,
        String primaryCategory,
        String reason
) {

    public boolean isAllowed() {
        return eligibility != null && eligibility.isAllowed();
    }

    public boolean isRejected() {
        return !isAllowed();
    }
}
