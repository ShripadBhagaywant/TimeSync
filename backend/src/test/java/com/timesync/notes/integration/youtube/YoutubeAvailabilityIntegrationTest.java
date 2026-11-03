package com.timesync.notes.integration.youtube;

import com.sun.net.httpserver.HttpServer;
import com.timesync.notes.config.RestClientConfig;
import com.timesync.notes.exception.UpstreamRateLimitException;
import com.timesync.notes.service.impl.*;
import com.timesync.notes.service.VideoExtractionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.*;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.test.context.support.TestPropertySourceUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.HttpServerErrorException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class YoutubeAvailabilityIntegrationTest {
    private HttpServer server;
    private AnnotationConfigApplicationContext context;
    private final AtomicInteger calls = new AtomicInteger();
    private final AtomicInteger status = new AtomicInteger(200);
    private String baseUrl;
    private static final String METADATA = "{\"items\":[{\"snippet\":{\"title\":\"Lesson\",\"description\":\"\"},\"contentDetails\":{}}]}";

    @BeforeEach void setup() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            calls.incrementAndGet();
            byte[] body = METADATA.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status.get(), body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        context = new AnnotationConfigApplicationContext();
        TestPropertySourceUtils.addInlinedPropertiesToEnvironment(context,
                "app.api-keys.youtube=test", "app.youtube.data-api-base-url=" + baseUrl,
                "app.youtube.watch-base-url=" + baseUrl + "/watch",
                "app.youtube.timedtext-base-url=" + baseUrl + "/timedtext",
                "app.youtube.retry.max-attempts=3", "app.youtube.retry.initial-delay-ms=1",
                "app.youtube.retry.max-delay-ms=2");
        context.register(Config.class);
        context.refresh();
    }

    @AfterEach void close() { if (context != null) context.close(); if (server != null) server.stop(0); }

    @Test void metadata429IsNotRetriedAndBlocksOtherEndpoints() {
        status.set(429);
        var service = context.getBean(YoutubeDataApiService.class);
        var failure = assertThrows(UpstreamRateLimitException.class, () -> service.getVideoMetadata("abcdefghijk"));
        assertTrue(failure.getRetryAfterSeconds() > 0);
        assertThrows(UpstreamRateLimitException.class, () -> service.getPlaylistMetadata("playlist"));
        assertEquals(1, calls.get());
    }

    @Test void serverErrorsStillRetry() {
        status.set(503);
        assertThrows(HttpServerErrorException.class,
                () -> context.getBean(YoutubeDataApiService.class).getVideoMetadata("abcdefghijk"));
        assertEquals(3, calls.get());
    }

    @Test void metadataCacheIsUsedEvenDuringCooldown() {
        var service = context.getBean(YoutubeDataApiService.class);
        var first = service.getVideoMetadata("abcdefghijk");
        context.getBean(YoutubeAvailabilityGuard.class).recordRateLimit(YoutubeAvailabilityScope.DATA_API);
        assertEquals(first, service.getVideoMetadata("abcdefghijk"));
        assertEquals(1, calls.get());
    }

    private VideoExtractionService extraction() {
        return context.getBean(VideoExtractionService.class);
    }

    @Test void networkErrorsStillRetry() {
        server.removeContext("/");
        server.createContext("/", exchange -> { calls.incrementAndGet(); exchange.close(); });
        assertThrows(ResourceAccessException.class,
                () -> context.getBean(YoutubeDataApiService.class).getVideoMetadata("abcdefghijk"));
        assertEquals(3, calls.get());
    }

    @Test void transcriptServerErrorsRetryAndRemainTemporary() {
        status.set(503);
        assertThrows(com.timesync.notes.exception.UpstreamServiceUnavailableException.class,
                () -> extraction().extractTranscript("abcdefghijk", "Original"));
        assertEquals(3, calls.get());
    }

    @Test void nativeChapter429IsOptionalAndCaption429RemainsCritical() {
        context.getBean(YoutubeDataApiService.class).getVideoMetadata("abcdefghijk");
        status.set(429);
        var service = extraction();
        assertTrue(service.extractChapters("abcdefghijk").isEmpty());
        assertThrows(UpstreamRateLimitException.class, () -> service.extractTranscript("abcdefghijk", "Original"));
        assertEquals(3, calls.get());
    }

    @Test void nativeChapter404ReturnsEmpty() {
        context.getBean(YoutubeDataApiService.class).getVideoMetadata("abcdefghijk");
        status.set(404);
        assertTrue(extraction().extractChapters("abcdefghijk").isEmpty());
        assertDoesNotThrow(() -> context.getBean(YoutubeAvailabilityGuard.class).checkAllowed());
    }

    @Test void caption429OpensCooldownWithoutFurtherCaptionAttempts() {
        status.set(429);
        assertThrows(UpstreamRateLimitException.class, () -> extraction().extractTranscript("abcdefghijk", "Original"));
        assertEquals(1, calls.get());
        assertThrows(UpstreamRateLimitException.class, context.getBean(YoutubeAvailabilityGuard.class)::checkAllowed);
    }

    @Test void content429DoesNotBlockOfficialDataApi() {
        status.set(429);
        assertThrows(UpstreamRateLimitException.class, () -> extraction().extractTranscript("abcdefghijk", "Original"));
        status.set(200);
        assertNotNull(context.getBean(YoutubeDataApiService.class).getVideoMetadata("abcdefghijk"));
        assertEquals(2, calls.get());
    }

    @Test void data429DoesNotBlockContent() {
        status.set(429);
        assertThrows(UpstreamRateLimitException.class, () -> context.getBean(YoutubeDataApiService.class).getVideoMetadata("abcdefghijk"));
        status.set(404);
        assertThrows(com.timesync.notes.exception.UnprocessableVideoException.class,
                () -> context.getBean(YoutubePlayerResponseClient.class).getPlayerResponseJson("abcdefghijk"));
        assertEquals(2, calls.get());
        assertEquals(0, context.getBean(YoutubeAvailabilityGuard.class).getRetryAfterSeconds(YoutubeAvailabilityScope.CAPTION));
    }

    @Test void localBusyIsNotRetriedOrWrappedByRecovery() throws Exception {
        var limiter = context.getBean(YoutubeConcurrencyLimiter.class);
        var failure = new com.timesync.notes.exception.YoutubeBusyException("busy");
        org.mockito.Mockito.doThrow(failure).when(limiter).execute(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        assertSame(failure, assertThrows(com.timesync.notes.exception.YoutubeBusyException.class,
                () -> extraction().extractTranscript("abcdefghijk", "Original")));
        org.mockito.Mockito.verify(limiter).execute(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        assertEquals(0, calls.get());
    }

    @Configuration
    @EnableRetry
    @EnableCaching
    static class Config {
        @Bean YoutubeAvailabilityGuard guard() { return new YoutubeAvailabilityGuard(60, 600); }
        @Bean YoutubeConcurrencyLimiter limiter() { return org.mockito.Mockito.spy(new YoutubeConcurrencyLimiter(3, 5000)); }
        @Bean RestClient client(YoutubeAvailabilityGuard guard, YoutubeConcurrencyLimiter limiter) { return new RestClientConfig().restClient(guard, YoutubeAvailabilityScope.CAPTION, limiter); }
        @Bean YoutubeDataApiService data(YoutubeAvailabilityGuard guard, YoutubeConcurrencyLimiter limiter) { return new YoutubeDataApiService(new RestClientConfig().restClient(guard, YoutubeAvailabilityScope.DATA_API, limiter)); }
        @Bean CacheManager caches() { return new ConcurrentMapCacheManager(); }
        @Bean YoutubePlayerResponseClient player(RestClient client,
                @org.springframework.beans.factory.annotation.Value("${app.youtube.watch-base-url}") String url) {
            return new YoutubePlayerResponseClient(client, url);
        }
        @Bean YoutubeExtractionServiceImpl extraction(RestClient client, YoutubeDataApiService data,
                YoutubePlayerResponseClient player, YoutubeAvailabilityGuard guard) {
            return new YoutubeExtractionServiceImpl(client, data, player, new ObjectMapper(), new YoutubeCaptionCircuitBreaker(guard));
        }
    }
}
