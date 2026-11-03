package com.timesync.notes.integration.gemini;

import java.net.http.HttpTimeoutException;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;
import static org.junit.jupiter.api.Assertions.*;

class GeminiFailureLogTest {
    @Test
    void exposesTimeoutTypeWithoutSensitiveMessages() {
        var failure = new ResourceAccessException("https://private.example?key=secret",
                new HttpTimeoutException("private response"));
        assertEquals("HttpTimeoutException", GeminiFailureLog.causeType(failure));
    }

    @Test
    void handlesCyclicCausesAndMissingFailure() {
        var first = new IllegalStateException("secret");
        var second = new IllegalArgumentException("private", first);
        first.initCause(second);
        assertEquals("IllegalArgumentException", GeminiFailureLog.causeType(first));
        assertEquals("Unknown", GeminiFailureLog.causeType(null));
    }
}
