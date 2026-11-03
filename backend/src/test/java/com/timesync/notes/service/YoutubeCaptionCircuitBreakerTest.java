package com.timesync.notes.service;

import com.timesync.notes.exception.UpstreamRateLimitException;
import com.timesync.notes.service.impl.YoutubeCaptionCircuitBreaker;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class YoutubeCaptionCircuitBreakerTest {

    @Test
    void concurrentSuccessDoesNotClearCooldown() {
        YoutubeCaptionCircuitBreaker circuit = new YoutubeCaptionCircuitBreaker(30, 60);

        assertDoesNotThrow(circuit::checkAllowed);
        circuit.recordRateLimit();
        assertThrows(UpstreamRateLimitException.class, circuit::checkAllowed);
        circuit.recordSuccess();
        assertThrows(UpstreamRateLimitException.class, circuit::checkAllowed);
    }
}
