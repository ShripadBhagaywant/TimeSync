package com.timesync.notes.integration.gemini;

import org.junit.jupiter.api.Test;
import java.util.concurrent.ExecutionException;
import static org.junit.jupiter.api.Assertions.*;

class GeminiFailureMapperTest {
    @Test void mapsGeminiQuotaResponseAndDecimalRetryDelay() {
        var failure = new ExecutionException(new RuntimeException("429 RESOURCE_EXHAUSTED quota exceeded. Please retry in 10.496s."));
        var result = GeminiFailureMapper.quotaException(failure);
        assertNotNull(result);
        assertEquals(11, result.getRetryAfterSeconds());
        assertSame(failure, result.getCause());
    }
    @Test void mapsGeminiHighDemandResponse() {
        var result = GeminiFailureMapper.unavailableException(new ExecutionException(
                new RuntimeException("503 UNAVAILABLE This model is currently experiencing high demand.")));
        assertNotNull(result);
        assertEquals(30, result.getRetryAfterSeconds());
    }
    @Test void usesFallbackForRetiredModelResponse() {
        assertTrue(GeminiFailureMapper.shouldUseFallback(new RuntimeException("404 NOT_FOUND model is no longer available")));
    }
    @Test void doesNotUseModelFallbackForGenericEndpoint404() {
        assertFalse(GeminiFailureMapper.shouldUseFallback(new RuntimeException("404 Not Found: /v1beta/openai/v1/chat/completions")));
    }
    @Test void recognizesPlain429WithoutChangingFallbackSelection() {
        var failure = new RuntimeException("429 Too Many Requests");
        assertEquals(60, GeminiFailureMapper.quotaException(failure).getRetryAfterSeconds());
        assertFalse(GeminiFailureMapper.shouldUseFallback(failure));
    }

    @Test void preservesExistingTypedProviderRetryHints() {
        var quota = new com.timesync.notes.exception.AiProviderQuotaException("Quota", null, 47);
        var unavailable = new com.timesync.notes.exception.AiProviderUnavailableException("Unavailable", null, 32);
        assertSame(quota, GeminiFailureMapper.quotaException(new RuntimeException(quota)));
        assertSame(unavailable, GeminiFailureMapper.unavailableException(new RuntimeException(unavailable)));
    }

    @Test void mapsWrappedTransportTimeoutToRetryableFailureAndFallback() {
        var error = new ExecutionException(new org.springframework.web.client.ResourceAccessException(
                "redacted", new java.net.SocketTimeoutException()));
        assertTrue(GeminiFailureMapper.shouldUseFallback(error));
        assertEquals(30, GeminiFailureMapper.unavailableException(error).getRetryAfterSeconds());
        assertTrue(GeminiFailureMapper.shouldUseFallback(
                new RuntimeException(new java.net.http.HttpTimeoutException("redacted"))));
    }

    @Test void networkFailureGetsCooldownWithoutTryingAnotherModel() {
        var error = new org.springframework.web.client.ResourceAccessException(
                "redacted", new java.net.UnknownHostException());
        assertFalse(GeminiFailureMapper.shouldUseFallback(error));
        assertNotNull(GeminiFailureMapper.unavailableException(error));
        assertFalse(GeminiFailureMapper.shouldUseFallback(new IllegalStateException("bad JSON")));
        assertNull(GeminiFailureMapper.unavailableException(new IllegalStateException("bad JSON")));
    }
}
