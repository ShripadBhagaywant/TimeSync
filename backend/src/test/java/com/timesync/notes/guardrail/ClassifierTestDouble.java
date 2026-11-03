package com.timesync.notes.guardrail;

import com.timesync.notes.entity.ContentEligibility;
import static org.mockito.Mockito.*;

/** Explicit verified response for tests of unrelated extraction/persistence behavior. */
public final class ClassifierTestDouble {
    private ClassifierTestDouble() {}
    public static EducationalContentClassifier approved() {
        return mock(EducationalContentClassifier.class, call -> {
            if (call.getMethod().getReturnType() == ContentPolicyDecision.class)
                return ContentPolicyDecision.semantic(ContentEligibility.EDUCATIONAL);
            if (call.getMethod().getReturnType() == ContentEligibility.class) return ContentEligibility.UNKNOWN;
            return RETURNS_DEFAULTS.answer(call);
        });
    }
}
