package com.timesync.notes.config;

import com.sun.net.httpserver.HttpServer;
import com.timesync.notes.entity.ContentEligibility;
import com.timesync.notes.exception.AiProviderUnavailableException;
import com.timesync.notes.guardrail.EducationalContentClassifier;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class VerificationClientConfigTest {
    @Test
    void verificationModelIsIndependentFromDraftModelWithExplicitOverride() throws Exception {
        var method = VerificationClientConfig.class.getMethod("verificationChatClient",
                String.class, String.class, String.class, String.class, int.class);
        String expression = method.getParameters()[3].getAnnotation(org.springframework.beans.factory.annotation.Value.class).value();
        var environment = new org.springframework.core.env.StandardEnvironment();
        var settings = new java.util.HashMap<String, Object>();
        settings.put("spring.ai.openai.chat.options.model", "draft-model");
        environment.getPropertySources().addFirst(new org.springframework.core.env.MapPropertySource("test-models", settings));
        assertEquals("draft-model", environment.resolveRequiredPlaceholders(expression));
        settings.put("app.gemini.fallback-model", "lightweight-model");
        assertEquals("lightweight-model", environment.resolveRequiredPlaceholders(expression));
        settings.put("app.gemini.verification-model", "verification-override");
        assertEquals("verification-override", environment.resolveRequiredPlaceholders(expression));
        assertEquals("draft-model", environment.getProperty("spring.ai.openai.chat.options.model"));
    }

    @Test
    void stalledProviderTimesOutWithoutRetryOrApproval() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var executor = Executors.newSingleThreadExecutor();
        var release = new CountDownLatch(1);
        var calls = new AtomicInteger();
        server.setExecutor(executor);
        server.createContext("/verify", exchange -> {
            calls.incrementAndGet();
            try { release.await(); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
        try {
            var client = new VerificationClientConfig().verificationChatClient("test-only",
                    "http://127.0.0.1:" + server.getAddress().getPort(), "/verify", "test-model", 1);
            var classifier = new EducationalContentClassifier(client);
            assertTimeoutPreemptively(Duration.ofSeconds(10), () -> {
                var failure = assertThrows(AiProviderUnavailableException.class, () ->
                        classifier.validateEducationalContent("Docker", "Teacher", "27", "Containers isolate applications.", "en", ContentEligibility.UNKNOWN));
                assertEquals("AI_PROVIDER_UNAVAILABLE", failure.getErrorCode());
            });
            assertEquals(1, calls.get());
        } finally {
            release.countDown();
            server.stop(0);
            executor.shutdownNow();
        }
    }

    @Test
    void usesConfiguredModelEndpointAndLowReasoningForVerification() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var captured = new java.util.concurrent.atomic.AtomicReference<String>();
        server.createContext("/verify", exchange -> {
            captured.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = "{\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":\"{\\\"eligibility\\\":\\\"EDUCATIONAL\\\",\\\"primaryCategory\\\":\\\"PROGRAMMING\\\",\\\"reason\\\":\\\"Teaches Docker\\\"}\"},\"finish_reason\":\"stop\"}]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            var client = new VerificationClientConfig().verificationChatClient("test-only",
                    "http://127.0.0.1:" + server.getAddress().getPort(), "/verify", "configured-model", 5);
            var decision = new EducationalContentClassifier(client).validateEducationalContent(
                    "Docker", "Teacher", "27", "Containers isolate applications.", "en", ContentEligibility.UNKNOWN);
            assertEquals(ContentEligibility.EDUCATIONAL, decision.eligibility());
            var request = new com.fasterxml.jackson.databind.ObjectMapper().readTree(captured.get());
            assertEquals("configured-model", request.path("model").asText());
            assertEquals("low", request.path("reasoning_effort").asText());
        } finally { server.stop(0); }
    }
}
