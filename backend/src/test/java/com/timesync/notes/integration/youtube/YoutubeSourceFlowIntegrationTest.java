package com.timesync.notes.integration.youtube;

import com.sun.net.httpserver.HttpServer;
import com.timesync.notes.dto.request.ExtractVideoRequest;
import com.timesync.notes.dto.response.TranscriptResponse;
import com.timesync.notes.exception.UpstreamRateLimitException;
import com.timesync.notes.guardrail.EducationalContentClassifier;
import com.timesync.notes.service.AiNoteJobService;
import com.timesync.notes.service.VideoExtractionService;
import com.timesync.notes.service.impl.TranscriptCleaningServiceImpl;
import com.timesync.notes.service.impl.YoutubeDataApiService;
import com.timesync.notes.service.note.TranscriptDraftFormatter;
import com.timesync.notes.strategy.RegexCleaningStrategy;
import com.timesync.notes.util.PastedTranscriptParser;
import org.junit.jupiter.api.*;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.*;
import org.springframework.test.context.support.TestPropertySourceUtils;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Timeout(15)
class YoutubeSourceFlowIntegrationTest {
    private final ch.qos.logback.classic.Logger diagnosticLogger = (ch.qos.logback.classic.Logger)
            org.slf4j.LoggerFactory.getLogger(YoutubeConcurrencyLimiter.class);
    private final ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> logs =
            new ch.qos.logback.core.read.ListAppender<>();
    private ch.qos.logback.classic.Level previousLevel;
    private HttpServer server;
    private AnnotationConfigApplicationContext context;
    private ExecutorService httpPool;
    private final ConcurrentHashMap<String, AtomicInteger> calls = new ConcurrentHashMap<>();
    private final CountDownLatch releaseWatch = new CountDownLatch(1);
    private CountDownLatch watchEntered;
    private int watchStatus;
    private int captionStatus = 200;
    private boolean missingCaptions;
    private boolean emptyDiscovery;
    private boolean creatorChapters;
    private String watchBody;
    private String subtitleBody;
    private int subtitleStatus = 200;

    private void start(int watchStatus, int watchCount) throws Exception {
        previousLevel = diagnosticLogger.getLevel();
        diagnosticLogger.setLevel(ch.qos.logback.classic.Level.DEBUG);
        logs.list = java.util.Collections.synchronizedList(new ArrayList<>());
        logs.start();
        diagnosticLogger.addAppender(logs);
        this.watchStatus = watchStatus;
        watchEntered = new CountDownLatch(watchCount);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        httpPool = Executors.newCachedThreadPool();
        server.setExecutor(httpPool);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            calls.computeIfAbsent(path, ignored -> new AtomicInteger()).incrementAndGet();
            int status = 200;
            String body;
            String contentType;
            if (path.equals("/watch")) {
                watchEntered.countDown();
                YoutubeSingleFlightTest.await(releaseWatch);
                if (this.watchStatus == 0) { exchange.close(); return; }
                status = this.watchStatus;
                body = this.watchStatus == 200 ? "ytInitialPlayerResponse = {\"playabilityStatus\":{\"status\":\"OK\"}};" : "";
                if (watchBody != null && status == 200) body = watchBody;
                contentType = "text/html";
            } else if (path.equals("/timedtext")) {
                if (exchange.getRequestURI().getQuery().contains("type=list")) {
                    body = "<transcript_list><track lang_code=\"en\" lang_original=\"English\" lang_translated=\"English\" /></transcript_list>";
                    contentType = "text/xml";
                } else {
                    body = "WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nThis lesson explains how variables and functions work in a computer program.\n";
                    contentType = "text/vtt";
                }
            } else {
                body = "{\"items\":[{\"snippet\":{\"title\":\"Programming lesson\",\"channelTitle\":\"Teacher\",\"categoryId\":\"27\",\"description\":\"\"},\"contentDetails\":{\"duration\":\"PT10M\"}}]}";
                contentType = "application/json";
            }
            if (path.equals("/timedtext")) {
                status = captionStatus;
                if (missingCaptions || (emptyDiscovery && exchange.getRequestURI().getQuery().contains("type=list"))) body = "";
                if (subtitleBody != null && !exchange.getRequestURI().getQuery().contains("type=list")) body = subtitleBody;
                if (!exchange.getRequestURI().getQuery().contains("type=list") && subtitleStatus != 200) {
                    if (subtitleStatus == 0) { exchange.close(); return; }
                    status = subtitleStatus;
                }
            }
            if (path.equals("/videos") && creatorChapters) {
                body = body.replace("\"description\":\"\"", "\"description\":\"00:00 Intro\\n00:05 Lesson\\n00:10 Summary\"");
            }
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Connection", "close");
            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
            if (bytes.length > 0) exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        context = new AnnotationConfigApplicationContext();
        TestPropertySourceUtils.addInlinedPropertiesToEnvironment(context,
                "app.api-keys.youtube=test", "app.youtube.data-api-base-url=" + base,
                "app.youtube.watch-base-url=" + base + "/watch",
                "app.youtube.timedtext-base-url=" + base + "/timedtext",
                "app.youtube.retry.max-attempts=3", "app.youtube.retry.initial-delay-ms=1",
                "app.youtube.retry.max-delay-ms=2");
        context.register(YoutubeAvailabilityIntegrationTest.Config.class, SourceConfig.class);
        context.refresh();
    }

    @AfterEach void close() {
        releaseWatch.countDown();
        if (context != null) context.close();
        if (server != null) server.stop(0);
        if (httpPool != null) httpPool.shutdownNow();
        diagnosticLogger.detachAppender(logs);
        diagnosticLogger.setLevel(previousLevel);
        logs.stop();
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(ints = {429, 503, 0, 404, 200})
    void optionalChapterOutcomesStillVerifyTranscript(int watchStatus) throws Exception {
        start(watchStatus, 1);
        releaseWatch.countDown();
        var result = context.getBean(TranscriptCleaningServiceImpl.class)
                .extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
        assertTrue(result.chapters().isEmpty());
        assertTrue(result.isEditableChapters());
        assertEquals(watchStatus == 200 || watchStatus == 404
                ? com.timesync.notes.entity.ChapterAvailability.NONE
                : com.timesync.notes.entity.ChapterAvailability.TEMPORARILY_UNAVAILABLE, result.chapterAvailability());
        if (watchStatus != 200 && watchStatus != 404) {
            assertNull(context.getBean(CacheManager.class).getCache("transcriptNotes").get("v9:abcdefghijk"));
        }
        assertEquals(2, count("/timedtext"));
        verify(context.getBean(EducationalContentClassifier.class))
                .validateEducationalContent(any(), any(), any(), contains("variables"), eq("en"), any());
        assertNotNull(context.getBean(YoutubeDataApiService.class).getVideoMetadata("12345678901"));
        assertEquals(0, context.getBean(YoutubeSingleFlight.class).inFlightCount());
        if (watchStatus == 429) {
            assertTrue(context.getBean(YoutubeAvailabilityGuard.class).getRetryAfterSeconds(YoutubeAvailabilityScope.WATCH_PAGE) > 0);
            assertEquals(0, context.getBean(YoutubeAvailabilityGuard.class).getRetryAfterSeconds(YoutubeAvailabilityScope.CAPTION));
        }
    }

    @Test void chapterDiscoveryRateLimitedReturnsTemporaryAvailabilityWithoutFailingExtraction() throws Exception {
        start(429, 1);
        releaseWatch.countDown();
        var service = context.getBean(TranscriptCleaningServiceImpl.class);
        var first = service.extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
        var second = service.extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
        assertEquals(com.timesync.notes.entity.ChapterAvailability.TEMPORARILY_UNAVAILABLE, first.chapterAvailability());
        assertEquals(first.chapterAvailability(), second.chapterAvailability());
        assertEquals(1, count("/watch"), "Cooldown must prevent a second outbound watch request");
        assertEquals(4, count("/timedtext"));
    }

    @Test void malformedChapterJsonDoesNotBlockTranscriptVerification() throws Exception {
        watchBody = "ytInitialData = {broken};";
        start(200, 1);
        releaseWatch.countDown();
        var result = context.getBean(TranscriptCleaningServiceImpl.class).extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
        assertEquals(com.timesync.notes.entity.ChapterAvailability.TEMPORARILY_UNAVAILABLE, result.chapterAvailability());
        assertTrue(result.isEditableChapters());
        verify(context.getBean(EducationalContentClassifier.class))
                .validateEducationalContent(any(), any(), any(), contains("variables"), eq("en"), any());
    }

    @Test void nestedWatchPageChaptersReachResponseAndAreReadOnly() throws Exception {
        watchBody = new String(getClass().getResourceAsStream("/youtube/watch-chapters.html").readAllBytes(), StandardCharsets.UTF_8);
        start(200, 1);
        releaseWatch.countDown();
        var result = context.getBean(TranscriptCleaningServiceImpl.class).extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
        assertEquals(com.timesync.notes.entity.ChapterAvailability.AVAILABLE, result.chapterAvailability());
        assertEquals(3, result.chapters().size());
        assertFalse(result.isEditableChapters());
        assertEquals(1, count("/watch"));
        assertEquals("AVAILABLE", new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(result).path("chapterAvailability").asText());
    }

    @Test void chapterCapacityFailureIsTemporaryAndTranscriptContinues() throws Exception {
        start(200, 1);
        releaseWatch.countDown();
        var limiter = context.getBean(YoutubeConcurrencyLimiter.class);
        doThrow(new com.timesync.notes.exception.YoutubeBusyException("busy")).when(limiter).execute(
                any(), any(), argThat(request -> request.getURI().getPath().equals("/watch")), any(), any());
        var result = context.getBean(TranscriptCleaningServiceImpl.class).extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
        assertEquals(com.timesync.notes.entity.ChapterAvailability.TEMPORARILY_UNAVAILABLE, result.chapterAvailability());
        assertTrue(result.isEditableChapters());
        assertEquals(0, count("/watch"));
        assertEquals(2, count("/timedtext"));
    }

    @Test void playlistCachePolicyKeepsPerVideoAvailabilityAndExcludesTemporaryResult() throws Exception {
        start(429, 1);
        releaseWatch.countDown();
        var unavailable = context.getBean(TranscriptCleaningServiceImpl.class).extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
        var available = unavailable.withChapterAvailability(com.timesync.notes.entity.ChapterAvailability.NONE);
        var playlist = com.timesync.notes.dto.response.PlaylistTranscriptResponse.builder()
                .videoNotes(java.util.List.of(available, unavailable)).build();
        var cacheable = com.timesync.notes.service.impl.PlaylistExtractionServiceImpl.class
                .getMethod("extractPlaylist", com.timesync.notes.dto.request.ExtractPlaylistRequest.class)
                .getAnnotation(org.springframework.cache.annotation.Cacheable.class);
        var evaluation = new org.springframework.expression.spel.support.StandardEvaluationContext();
        evaluation.setVariable("result", playlist);
        var expression = new org.springframework.expression.spel.standard.SpelExpressionParser().parseExpression(cacheable.unless());
        assertEquals(true, expression.getValue(evaluation, Boolean.class));
        assertEquals(com.timesync.notes.entity.ChapterAvailability.NONE, playlist.videoNotes().get(0).chapterAvailability());
        evaluation.setVariable("result", com.timesync.notes.dto.response.PlaylistTranscriptResponse.builder().videoNotes(java.util.List.of(available)).build());
        assertEquals(false, expression.getValue(evaluation, Boolean.class));
    }

    @Test void caption429StillAbortsAfterOptionalChapter429() throws Exception {
        captionStatus = 429;
        start(429, 1);
        releaseWatch.countDown();
        var failure = assertThrows(UpstreamRateLimitException.class, () -> context.getBean(TranscriptCleaningServiceImpl.class)
                .extractAndProcess(new ExtractVideoRequest("abcdefghijk")));
        assertEquals(YoutubeContentOperation.TIMEDTEXT_DISCOVERY, failure.getOperation());
        assertEquals("YOUTUBE_RATE_LIMITED", failure.getErrorCode());
        assertEquals(1, count("/timedtext"));
        assertNull(context.getBean(CacheManager.class).getCache("transcriptNotes").get("v9:abcdefghijk"));
        verify(context.getBean(EducationalContentClassifier.class), never())
                .validateEducationalContent(any(), any(), any(), any(), any(), any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(ints = {200, 429, 503})
    void permanentAbsenceOpensMetadataWorkspaceAndIsNotTranscriptCached(int chapterStatus) throws Exception {
        missingCaptions = true;
        start(chapterStatus, 1);
        releaseWatch.countDown();
        var source = context.getBean(TranscriptCleaningServiceImpl.class);
        var result = source.extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
        assertEquals(com.timesync.notes.entity.NoteSource.METADATA, result.noteSource());
        assertEquals(com.timesync.notes.entity.TranscriptAvailability.UNAVAILABLE, result.transcriptAvailability());
        assertTrue(result.chapters().isEmpty());
        assertTrue(result.isEditableChapters());
        assertNull(context.getBean(CacheManager.class).getCache("transcriptNotes").get("v9:abcdefghijk"));
        verify(context.getBean(EducationalContentClassifier.class), never())
                .validateEducationalContent(any(), any(), any(), any(), any(), any());
        verifyNoInteractions(context.getBean(AiNoteJobService.class));
        int before = count("/timedtext");
        missingCaptions = false;
        var available = source.extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
        assertEquals(com.timesync.notes.entity.NoteSource.CAPTIONS, available.noteSource());
        assertTrue(count("/timedtext") > before);
        if (chapterStatus == 200) assertNotNull(context.getBean(CacheManager.class).getCache("transcriptNotes").get("v9:abcdefghijk"));
        else assertNull(context.getBean(CacheManager.class).getCache("transcriptNotes").get("v9:abcdefghijk"));
    }

    @Test void caption503NeverBecomesMetadataSuccessOrCacheEntry() throws Exception {
        captionStatus = 503;
        start(200, 1);
        releaseWatch.countDown();
        assertThrows(com.timesync.notes.exception.UpstreamServiceUnavailableException.class,
                () -> context.getBean(TranscriptCleaningServiceImpl.class).extractAndProcess(new ExtractVideoRequest("abcdefghijk")));
        assertNull(context.getBean(CacheManager.class).getCache("transcriptNotes").get("v9:abcdefghijk"));
        verify(context.getBean(EducationalContentClassifier.class), never())
                .validateEducationalContent(any(), any(), any(), any(), any(), any());
    }

    @Test void watchCooldownDoesNotPreventLegacyCaptionRetrieval() throws Exception {
        emptyDiscovery = true;
        start(429, 1);
        releaseWatch.countDown();
        var result = context.getBean(TranscriptCleaningServiceImpl.class).extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
        assertTrue(result.isEditableChapters());
        assertEquals(1, count("/watch"));
        assertTrue(count("/timedtext") >= 2);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"XML", "EMPTY", "HTML"})
    void descriptionChaptersAndWatch429StillValidateActualSubtitlePayload(String kind) throws Exception {
        creatorChapters = true;
        emptyDiscovery = true; // Available listing is empty: watch discovery is attempted.
        subtitleBody = switch (kind) {
            case "XML" -> "<transcript><text start='1.5' dur='3'>This lesson explains variables and functions in a program.</text></transcript>";
            case "HTML" -> "<html><body>Consent required</body></html>";
            default -> "";
        };
        start(429, 1);
        releaseWatch.countDown();
        var service = context.getBean(TranscriptCleaningServiceImpl.class);
        if (kind.equals("HTML")) {
            assertThrows(com.timesync.notes.exception.UpstreamServiceUnavailableException.class,
                () -> service.extractAndProcess(new ExtractVideoRequest("abcdefghijk")));
        } else {
            var result = service.extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
            assertFalse(result.chapters().isEmpty());
            assertEquals(kind.equals("XML") ? com.timesync.notes.entity.NoteSource.CAPTIONS : com.timesync.notes.entity.NoteSource.METADATA, result.noteSource());
            if (kind.equals("XML")) verify(context.getBean(EducationalContentClassifier.class))
                .validateEducationalContent(any(), any(), any(), contains("variables"), any(), any());
        }
        assertEquals(1, count("/watch"));
        assertTrue(context.getBean(YoutubeAvailabilityGuard.class).getRetryAfterSeconds(YoutubeAvailabilityScope.WATCH_PAGE) > 0);
        assertEquals(0, context.getBean(YoutubeAvailabilityGuard.class).getRetryAfterSeconds(YoutubeAvailabilityScope.CAPTION));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(ints = {429, 503, 0})
    void subtitleTransportFailuresNeverBecomeCaptionAbsence(int status) throws Exception {
        creatorChapters = true;
        subtitleStatus = status;
        start(200, 0);
        releaseWatch.countDown();
        var failure = assertThrows(com.timesync.notes.exception.ApiException.class,
            () -> context.getBean(TranscriptCleaningServiceImpl.class).extractAndProcess(new ExtractVideoRequest("abcdefghijk")));
        assertEquals(status == 429 ? "YOUTUBE_RATE_LIMITED" : "UPSTREAM_SERVICE_UNAVAILABLE", failure.getErrorCode());
        verify(context.getBean(EducationalContentClassifier.class), never()).validateEducationalContent(any(), any(), any(), any(), any(), any());
    }

    @Test void creatorChaptersRemainReadOnlyWithoutWatchRequest() throws Exception {
        creatorChapters = true;
        start(429, 1);
        releaseWatch.countDown();
        var result = context.getBean(TranscriptCleaningServiceImpl.class).extractAndProcess(new ExtractVideoRequest("abcdefghijk"));
        assertEquals(com.timesync.notes.entity.ChapterAvailability.AVAILABLE, result.chapterAvailability());
        assertFalse(result.chapters().isEmpty());
        assertFalse(result.isEditableChapters());
        assertEquals(0, count("/watch"));
    }

    @Test void tenNormalizedRequestsShareExtractionAndThenUseCachedResultDuringCooldown() throws Exception {
        start(404, 1);
        ExecutorService callers = Executors.newFixedThreadPool(10);
        try {
            var source = context.getBean(TranscriptCleaningServiceImpl.class);
            var coordinator = context.getBean(YoutubeSingleFlight.class);
            var results = new ArrayList<Future<TranscriptResponse>>();
            results.add(callers.submit(() -> source.extractAndProcess(new ExtractVideoRequest("abcdefghijk"))));
            assertTrue(watchEntered.await(3, TimeUnit.SECONDS));
            for (int i = 1; i < 10; i++) {
                String url = i % 2 == 0 ? "https://youtu.be/abcdefghijk" : "https://www.youtube.com/watch?v=abcdefghijk";
                results.add(callers.submit(() -> source.extractAndProcess(new ExtractVideoRequest(url))));
            }
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
            while (coordinator.participants("abcdefghijk") < 10 && System.nanoTime() < deadline) Thread.onSpinWait();
            assertEquals(10, coordinator.participants("abcdefghijk"));
            releaseWatch.countDown();
            TranscriptResponse first = results.get(0).get(5, TimeUnit.SECONDS);
            for (var result : results) assertSame(first, result.get(5, TimeUnit.SECONDS));
            assertEquals(1, count("/videos"));
            assertEquals(1, count("/watch"));
        assertTrue(logMessages().contains("operation=CHAPTER_DISCOVERY"));
            assertEquals(2, count("/timedtext"));
            assertTrue(logMessages().contains("request starting. operation=TIMEDTEXT_DISCOVERY"));
            assertTrue(logMessages().contains("request starting. operation=SUBTITLE_DOWNLOAD"));
            verify(context.getBean(EducationalContentClassifier.class))
                    .validateEducationalContent(any(), any(), any(), contains("variables"), eq("en"), any());
            assertSame(first, context.getBean(CacheManager.class).getCache("transcriptNotes").get("v9:abcdefghijk").get());
            context.getBean(YoutubeAvailabilityGuard.class).recordRateLimit(YoutubeAvailabilityScope.CAPTION);
            context.getBean(YoutubeAvailabilityGuard.class).recordRateLimit(YoutubeAvailabilityScope.DATA_API);
            assertSame(first, source.extractAndProcess(new ExtractVideoRequest("abcdefghijk")));
            assertEquals(2, count("/timedtext"));
            assertTrue(logMessages().contains("request starting. operation=TIMEDTEXT_DISCOVERY"));
            assertTrue(logMessages().contains("request starting. operation=SUBTITLE_DOWNLOAD"));
            assertEquals(0, coordinator.inFlightCount());
            verifyNoInteractions(context.getBean(AiNoteJobService.class));
        } finally { releaseWatch.countDown(); callers.shutdownNow(); }
    }

    @Test void differentVideoExtractionsOverlapWithoutSharingResults() throws Exception {
        start(404, 2);
        ExecutorService callers = Executors.newFixedThreadPool(2);
        try {
            var source = context.getBean(TranscriptCleaningServiceImpl.class);
            var first = callers.submit(() -> source.extractAndProcess(new ExtractVideoRequest("abcdefghijk")));
            var second = callers.submit(() -> source.extractAndProcess(new ExtractVideoRequest("12345678901")));
            assertTrue(watchEntered.await(3, TimeUnit.SECONDS));
            releaseWatch.countDown();
            assertNotSame(first.get(5, TimeUnit.SECONDS), second.get(5, TimeUnit.SECONDS));
            assertEquals(2, count("/videos"));
            assertEquals(2, count("/watch"));
            assertEquals(4, count("/timedtext"));
            assertEquals(0, context.getBean(YoutubeSingleFlight.class).inFlightCount());
        } finally { releaseWatch.countDown(); callers.shutdownNow(); }
    }

    @Test void standaloneWatchFailureHasWatchOperation() throws Exception {
        start(429, 1);
        releaseWatch.countDown();
        var error = assertThrows(UpstreamRateLimitException.class,
                () -> context.getBean(YoutubePlayerResponseClient.class).getPlayerResponseJson("abcdefghijk"));
        assertEquals(YoutubeContentOperation.WATCH_PAGE, error.getOperation());
        assertTrue(logMessages().contains("rate-limited. operation=WATCH_PAGE"));
    }

    @Test void operationContextDoesNotFragmentPlayerCache() throws Exception {
        start(200, 1);
        releaseWatch.countDown();
        var player = context.getBean(YoutubePlayerResponseClient.class);
        String first = player.getPlayerResponseJson("abcdefghijk", YoutubeContentOperation.CHAPTER_DISCOVERY);
        assertEquals(first, player.getPlayerResponseJson("abcdefghijk", YoutubeContentOperation.WATCH_PAGE));
        assertEquals(first, player.getPlayerResponseJson("abcdefghijk"));
        assertEquals(1, count("/watch"));
        assertNotNull(context.getBean(CacheManager.class).getCache("youtubePlayerResponses").get("v1:abcdefghijk"));
        assertFalse(logMessages().contains("request starting. operation=WATCH_PAGE"));
    }

    private String logMessages() {
        return logs.list.stream().map(ch.qos.logback.classic.spi.ILoggingEvent::getFormattedMessage)
                .collect(java.util.stream.Collectors.joining("\n"));
    }

    private int count(String path) { return calls.getOrDefault(path, new AtomicInteger()).get(); }

    @Configuration
    @Import({YoutubeSingleFlight.class, YoutubeTranscriptCache.class})
    static class SourceConfig {
        @Bean EducationalContentClassifier classifier() { return com.timesync.notes.guardrail.ClassifierTestDouble.approved(); }
        @Bean AiNoteJobService jobs() { return mock(AiNoteJobService.class); }
        @Bean TranscriptCleaningServiceImpl source(VideoExtractionService extraction,
                EducationalContentClassifier classifier, AiNoteJobService jobs,
                YoutubeSingleFlight singleFlight, YoutubeTranscriptCache cache) {
            return new TranscriptCleaningServiceImpl(extraction, new RegexCleaningStrategy("\\[Music\\]", "\\s+"),
                    classifier, jobs, new PastedTranscriptParser(), new TranscriptDraftFormatter(), singleFlight, cache);
        }
    }
}
