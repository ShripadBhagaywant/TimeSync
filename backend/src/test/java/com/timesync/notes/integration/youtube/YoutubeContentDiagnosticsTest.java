package com.timesync.notes.integration.youtube;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.timesync.notes.exception.GlobalExceptionHandler;
import com.timesync.notes.exception.UpstreamRateLimitException;
import org.junit.jupiter.api.*;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.mock.http.client.MockClientHttpResponse;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;

import static org.junit.jupiter.api.Assertions.*;

class YoutubeContentDiagnosticsTest {
    private final Logger logger = (Logger) LoggerFactory.getLogger(YoutubeConcurrencyLimiter.class);
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    private Level previous;
    private final YoutubeAvailabilityGuard guard = new YoutubeAvailabilityGuard(60, 600);
    private final YoutubeConcurrencyLimiter limiter = new YoutubeConcurrencyLimiter(1, 0);

    @BeforeEach void capture() {
        previous = logger.getLevel();
        logger.setLevel(Level.DEBUG);
        appender.start();
        logger.addAppender(appender);
    }
    @AfterEach void cleanup() {
        logger.detachAppender(appender);
        logger.setLevel(previous);
        appender.stop();
    }

    private void execute(YoutubeContentOperation operation, YoutubeAvailabilityScope scope, ClientHttpRequestExecution execution) {
        var request = new MockClientHttpRequest(HttpMethod.GET,
                URI.create("https://www.youtube.com/api/timedtext?v=abcdefghijk&signature=SECRET_SIGNED&key=SECRET_KEY"));
        request.getHeaders().set("Cookie", "SECRET_COOKIE");
        request.getHeaders().set("Authorization", "SECRET_AUTH");
        YoutubeContentRequestContext.with(operation, "abcdefghijk", () -> {
            try { return limiter.execute(guard, scope, request, new byte[0], execution); }
            catch (IOException failure) { throw new UncheckedIOException(failure); }
        });
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(YoutubeContentOperation.class)
    void real429CarriesInternalOperationAndPublicResponseIsUnchanged(YoutubeContentOperation operation) {
        try (var ignored = MDC.putCloseable("traceId", "diagnostic-trace")) {
            var error = assertThrows(UpstreamRateLimitException.class, () -> execute(
                    operation, YoutubeAvailabilityScope.CAPTION,
                    (request, body) -> new MockClientHttpResponse("SECRET_BODY".getBytes(), HttpStatus.TOO_MANY_REQUESTS)));
            assertEquals(operation, error.getOperation());
            assertEquals(60, error.getRetryAfterSeconds());
            var response = new GlobalExceptionHandler().handleUpstreamRateLimit(error);
            assertEquals(429, response.getStatusCode().value());
            assertEquals("60", response.getHeaders().getFirst("Retry-After"));
            assertFalse(response.getBody().getProperties().containsKey("operation"));
            assertEquals("YOUTUBE_RATE_LIMITED", response.getBody().getProperties().get("code"));
            assertTrue(messages().contains("rate-limited. operation=" + operation + ", host=www.youtube.com, status=429, videoId=abcdefghijk"));
            assertEquals("diagnostic-trace", appender.list.get(0).getMDCPropertyMap().get("traceId"));
        }
        assertSafe();
        assertNull(YoutubeContentRequestContext.current().operation());
        assertEquals(0, guard.getRetryAfterSeconds(YoutubeAvailabilityScope.DATA_API));
    }

    @Test void allFourOperationsLogSuccessWithDebugOnlyDuration() {
        for (var operation : YoutubeContentOperation.values()) {
            execute(operation, YoutubeAvailabilityScope.CAPTION,
                    (request, body) -> new MockClientHttpResponse("SECRET_BODY".getBytes(), HttpStatus.OK));
            assertTrue(messages().contains("request starting. operation=" + operation));
            assertTrue(messages().contains("request completed. operation=" + operation + ", status=200, durationMs="));
        }
        assertTrue(appender.list.stream().allMatch(event -> event.getLevel() == Level.DEBUG));
        assertSafe();
    }

    @Test void upstreamAndNetworkFailuresDoNotLogRawMessagesOrBodies() {
        execute(YoutubeContentOperation.SUBTITLE_DOWNLOAD, YoutubeAvailabilityScope.CAPTION,
                (request, body) -> new MockClientHttpResponse("SECRET_BODY".getBytes(), HttpStatus.SERVICE_UNAVAILABLE));
        var original = new IOException("https://signed.example/caption?key=SECRET_KEY");
        var thrown = assertThrows(UncheckedIOException.class, () -> execute(
                YoutubeContentOperation.TIMEDTEXT_DISCOVERY, YoutubeAvailabilityScope.CAPTION,
                (request, body) -> { throw original; }));
        assertSame(original, thrown.getCause());
        assertTrue(messages().contains("failed upstream. operation=SUBTITLE_DOWNLOAD"));
        assertTrue(messages().contains("network failure. operation=TIMEDTEXT_DISCOVERY"));
        assertTrue(messages().contains("error=IOException"));
        assertTrue(appender.list.stream().filter(event -> event.getFormattedMessage().contains("durationMs="))
                .allMatch(event -> event.getLevel() == Level.DEBUG));
        assertTrue(appender.list.stream().allMatch(event -> event.getThrowableProxy() == null));
        assertSafe();
    }

    @Test void cooldownAndDataApiDoNotProduceContentRequestLogs() {
        execute(YoutubeContentOperation.WATCH_PAGE, YoutubeAvailabilityScope.DATA_API,
                (request, body) -> new MockClientHttpResponse(new byte[0], HttpStatus.OK));
        assertTrue(appender.list.isEmpty());
        guard.recordRateLimit(YoutubeAvailabilityScope.WATCH_PAGE);
        assertThrows(UpstreamRateLimitException.class, () -> execute(
                YoutubeContentOperation.WATCH_PAGE, YoutubeAvailabilityScope.CAPTION,
                (request, body) -> { fail("No outbound request"); return null; }));
        assertTrue(appender.list.isEmpty());
    }

    @Test void contextRestoresNestedCallsEvenAfterFailureAndSanitizesVideoId() {
        YoutubeContentRequestContext.with(YoutubeContentOperation.WATCH_PAGE, "abcdefghijk", () -> {
            assertThrows(IllegalStateException.class, () -> YoutubeContentRequestContext.with(
                    YoutubeContentOperation.SUBTITLE_DOWNLOAD, "https://secret", () -> {
                        assertEquals("unknown", YoutubeContentRequestContext.current().videoId());
                        throw new IllegalStateException();
                    }));
            assertEquals(YoutubeContentOperation.WATCH_PAGE, YoutubeContentRequestContext.current().operation());
            return null;
        });
        assertNull(YoutubeContentRequestContext.current().operation());
    }

    @Test void localBusyDoesNotPretendToStartAnotherHttpRequest() {
        execute(YoutubeContentOperation.WATCH_PAGE, YoutubeAvailabilityScope.CAPTION, (request, body) -> {
            assertThrows(com.timesync.notes.exception.YoutubeBusyException.class, () -> execute(
                    YoutubeContentOperation.SUBTITLE_DOWNLOAD, YoutubeAvailabilityScope.CAPTION,
                    (nestedRequest, nestedBody) -> { fail("Busy request must not execute"); return null; }));
            return new MockClientHttpResponse(new byte[0], HttpStatus.OK);
        });
        assertFalse(messages().contains("operation=SUBTITLE_DOWNLOAD"));
        assertEquals(1, appender.list.stream().filter(event -> event.getFormattedMessage().contains("request starting")).count());
    }

    @Test void responseDownloadFailureUsesSafeErrorCategory() {
        assertThrows(UncheckedIOException.class, () -> execute(YoutubeContentOperation.SUBTITLE_DOWNLOAD,
                YoutubeAvailabilityScope.CAPTION, (request, body) -> new MockClientHttpResponse(
                        new java.io.InputStream() {
                            @Override public int read() throws IOException {
                                throw new IOException("https://signed.example/?signature=SECRET_SIGNED");
                            }
                        }, HttpStatus.OK)));
        assertTrue(messages().contains("network failure. operation=SUBTITLE_DOWNLOAD"));
        assertSafe();
        assertEquals(1, limiter.availablePermits());
    }

    private String messages() {
        return appender.list.stream().map(ILoggingEvent::getFormattedMessage).collect(java.util.stream.Collectors.joining("\n"));
    }
    private void assertSafe() {
        for (String forbidden : new String[]{"https://", "signature=", "SECRET_", "Authorization", "Cookie", "/api/timedtext"}) {
            assertFalse(messages().contains(forbidden), forbidden);
        }
    }
}