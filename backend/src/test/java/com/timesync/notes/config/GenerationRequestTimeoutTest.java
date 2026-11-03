package com.timesync.notes.config;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;
import static org.junit.jupiter.api.Assertions.*;

class GenerationRequestTimeoutTest {
    @Test void stalledGenerationRequestIsBoundedWithoutHiddenRetry() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var executor = Executors.newSingleThreadExecutor();
        var release = new CountDownLatch(1);
        var calls = new AtomicInteger();
        server.setExecutor(executor);
        server.createContext("/generate", exchange -> {
            calls.incrementAndGet();
            try { release.await(); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
        try {
            var client = new SpringAiConfig().geminiRestClientBuilder(2).build();
            assertTimeoutPreemptively(Duration.ofSeconds(10), () -> {
                var failure = assertThrows(ResourceAccessException.class, () -> client.post()
                        .uri("http://127.0.0.1:" + server.getAddress().getPort() + "/generate")
                        .body("test").retrieve().body(String.class));
                assertTrue(com.timesync.notes.integration.gemini.GeminiFailureMapper.shouldUseFallback(failure));
            });
            assertEquals(1, calls.get());
        } finally {
            release.countDown();
            server.stop(0);
            executor.shutdownNow();
        }
    }
}
