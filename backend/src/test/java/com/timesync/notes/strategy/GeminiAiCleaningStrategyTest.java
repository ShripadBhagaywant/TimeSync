package com.timesync.notes.strategy;

import org.junit.jupiter.api.Test;
import com.timesync.notes.dto.response.CleanedNoteResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GeminiAiCleaningStrategyTest {

    @Test void requestTimeoutUsesFallbackOnceAndPreservesOutputLanguage() {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            List<String> models = new ArrayList<>();
            var strategy = new GeminiAiCleaningStrategy(null, executor, "prompt", 60, "primary", "fallback",
                    (chunk, index, total, title, language, chapters, model) -> {
                        models.add(model);
                        assertEquals("Hindi", language);
                        if (model.equals("primary")) throw new org.springframework.web.client.ResourceAccessException(
                                "redacted", new java.net.SocketTimeoutException());
                        return new CleanedNoteResponse("draft", List.of());
                    });
            var result = strategy.processChunks("source", "Hindi", "Lesson", false);
            assertEquals(List.of("primary", "fallback"), models);
            assertEquals("draft", result.get(0).cleanedNotes());
        } finally { executor.shutdownNow(); }
    }

    @Test void bothModelsTimingOutReturnProviderCooldownWithoutFurtherAttempts() {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            List<String> models = new ArrayList<>();
            var strategy = new GeminiAiCleaningStrategy(null, executor, "prompt", 60, "primary", "fallback",
                    (chunk, index, total, title, language, chapters, model) -> {
                        models.add(model);
                        throw new org.springframework.web.client.ResourceAccessException(
                                "redacted", new java.net.SocketTimeoutException());
                    });
            var failure = org.junit.jupiter.api.Assertions.assertThrows(
                    com.timesync.notes.exception.AiProviderUnavailableException.class,
                    () -> strategy.processChunks("source", "English", "Lesson", false));
            assertEquals(List.of("primary", "fallback"), models);
            assertEquals(30, failure.getRetryAfterSeconds());
        } finally { executor.shutdownNow(); }
    }

    @Test void inheritsCallerMdcAndRestoresWorkerContextIncludingAfterFailure() throws Exception {
        ExecutorService executor = new com.timesync.notes.config.ThreadPoolConfig().aiChunkExecutor(1);
        var original = org.slf4j.MDC.getCopyOfContextMap();
        try {
            executor.submit(() -> org.slf4j.MDC.put("traceId", "worker-previous")).get();
            List<String> traces = new ArrayList<>();
            var strategy = new GeminiAiCleaningStrategy(null, executor, "prompt", 60, "primary", "fallback",
                    (chunk, index, total, title, language, chapters, model) -> {
                        traces.add(org.slf4j.MDC.get("traceId"));
                        if (chunk.equals("failure")) throw new IllegalStateException("unexpected");
                        return new CleanedNoteResponse("draft", List.of());
                    });
            org.slf4j.MDC.put("traceId", "abc123");
            strategy.processChunks("source", "English", "Lesson", false);
            assertEquals("abc123", traces.get(0));
            assertEquals("abc123", org.slf4j.MDC.get("traceId"));
            assertEquals("worker-previous", executor.submit(() -> org.slf4j.MDC.get("traceId")).get());
            org.slf4j.MDC.clear();
            strategy.processChunks("no parent", "English", "Lesson", false);
            org.junit.jupiter.api.Assertions.assertNull(traces.get(1));
            org.junit.jupiter.api.Assertions.assertThrows(com.timesync.notes.exception.ApiException.class,
                    () -> strategy.processChunks("failure", "English", "Lesson", false));
            org.junit.jupiter.api.Assertions.assertNull(traces.get(2));
            assertEquals("worker-previous", executor.submit(() -> org.slf4j.MDC.get("traceId")).get());
            executor.submit(org.slf4j.MDC::clear).get();
            org.slf4j.MDC.put("traceId", "another-parent");
            strategy.processChunks("source", "English", "Lesson", false);
            org.junit.jupiter.api.Assertions.assertNull(executor.submit(() -> org.slf4j.MDC.get("traceId")).get());
        } finally {
            executor.shutdownNow();
            if (original == null) org.slf4j.MDC.clear(); else org.slf4j.MDC.setContextMap(original);
        }
    }

    @Test void blankModelSettingsUseConfiguredPrimaryAndExistingFallbackDefaults() {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            List<String> models = new ArrayList<>();
            var strategy = new GeminiAiCleaningStrategy(null, executor, "prompt", 60, " ", null,
                    (chunk, index, total, title, language, chapters, model) -> {
                        models.add(model);
                        if (models.size() == 1) throw new RuntimeException("503 UNAVAILABLE high demand");
                        return new CleanedNoteResponse("draft", List.of());
                    });
            strategy.processChunks("source", "English", "Lesson", false);
            assertEquals(List.of("gemini-3.8-flash", "gemini-3.5-flash-lite"), models);
        } finally { executor.shutdownNow(); }
    }

    @Test
    void cachedFiveChunksStillGenerateTenFreshResponsesAndChangedSourceIsUsed() {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            var manager = new org.springframework.cache.concurrent.ConcurrentMapCacheManager("aiTranscriptChunks");
            var chunks = org.mockito.Mockito.spy(new com.timesync.notes.service.TranscriptChunkService(manager));
            List<String> inputs = new ArrayList<>();
            List<String> languages = new ArrayList<>();
            var strategy = new GeminiAiCleaningStrategy(null, executor, "prompt", 60, "primary", "fallback",
                    (chunk, index, total, title, language, hasChapters, model) -> {
                        inputs.add(chunk); languages.add(language);
                        return new CleanedNoteResponse("fresh " + inputs.size(), List.of());
                    });
            org.springframework.test.util.ReflectionTestUtils.setField(strategy, "transcriptChunkService", chunks);
            String source = "a".repeat(96001);
            var set = chunks.getOrCreate(source);
            assertEquals(5, set.chunks().size());
            var first = strategy.processChunks(source, "English", "Same video", false);
            var second = strategy.processChunks(source, "Hindi", "Same video", false);
            assertEquals(10, inputs.size());
            assertEquals(set.chunks(), inputs.subList(0, 5));
            assertEquals(set.chunks(), inputs.subList(5, 10));
            assertEquals("fresh 1", first.get(0).cleanedNotes());
            assertEquals("fresh 6", second.get(0).cleanedNotes());
            assertTrue(languages.subList(5, 10).stream().allMatch("Hindi"::equals));
            assertTrue(set == chunks.getOrCreate(source));
            strategy.processChunks("replacement source", "English", "Same video", false);
            assertEquals("replacement source", inputs.get(10));
        } finally { executor.shutdownNow(); }
    }

    @Test
    @SuppressWarnings("unchecked")
    void timeoutStillCancelsWorkerWithCachedChunks() throws Exception {
        ExecutorService executor = org.mockito.Mockito.mock(ExecutorService.class);
        java.util.concurrent.Future<Object> future = org.mockito.Mockito.mock(java.util.concurrent.Future.class);
        org.mockito.Mockito.doReturn(future).when(executor).submit(org.mockito.ArgumentMatchers.any(java.util.concurrent.Callable.class));
        org.mockito.Mockito.when(future.get(org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.eq(java.util.concurrent.TimeUnit.NANOSECONDS)))
                .thenThrow(new java.util.concurrent.TimeoutException());
        var strategy = new GeminiAiCleaningStrategy(null, executor, "prompt", 60, "primary", "fallback");
        var cache = new com.timesync.notes.service.TranscriptChunkService(new org.springframework.cache.concurrent.ConcurrentMapCacheManager("aiTranscriptChunks"));
        cache.getOrCreate("source");
        org.springframework.test.util.ReflectionTestUtils.setField(strategy, "transcriptChunkService", cache);
        var error = org.junit.jupiter.api.Assertions.assertThrows(com.timesync.notes.exception.ApiException.class,
                () -> strategy.processChunks("source", "English", "Video", false));
        assertEquals("AI_PROCESSING_TIMEOUT", error.getErrorCode());
        org.mockito.Mockito.verify(future).cancel(true);
    }

    @Test
    void primarySuccessNeverUsesFallback() {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            List<String> models = new ArrayList<>();
            var strategy = new GeminiAiCleaningStrategy(null, executor, "prompt", 60, "primary", "fallback",
                    (chunk, index, total, title, language, hasChapters, model) -> {
                        models.add(model);
                        return new CleanedNoteResponse("chunk " + index, List.of());
                    });
            strategy.processStructuredNotes("A sentence with enough words for chunking. ".repeat(1400), "English", "Video", false);
            assertTrue(models.size() >= 3);
            assertTrue(models.stream().allMatch("primary"::equals));
        } finally { executor.shutdownNow(); }
    }

    @Test
    void reservesOneAdditionalCallForPossibleStickyFallback() {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            GeminiAiCleaningStrategy strategy = new GeminiAiCleaningStrategy(
                    null, executor, "prompt", 60,
                    "gemini-3.8-flash", "gemini-3.5-flash-lite");

            assertEquals(2, strategy.estimateRequiredCalls("short transcript"));
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void fallbackRemainsStickyForRemainingChunksAfterPrimary503() {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            List<String> models = new ArrayList<>();
            GeminiAiCleaningStrategy strategy = new GeminiAiCleaningStrategy(
                    null, executor, "prompt", 60,
                    "primary", "fallback",
                    (chunk, chunkIndex, totalChunks, videoTitle, targetLanguage,
                     chaptersAlreadyAvailable, model) -> {
                        models.add(model);
                        if (model.equals("primary")) {
                            throw new RuntimeException(
                                    "503 UNAVAILABLE model is experiencing high demand");
                        }
                        return new CleanedNoteResponse("chunk " + chunkIndex, List.of());
                    });

            String transcript = "A sentence with enough words for chunking. ".repeat(900);
            var cache = new com.timesync.notes.service.TranscriptChunkService(new org.springframework.cache.concurrent.ConcurrentMapCacheManager("aiTranscriptChunks"));
            org.springframework.test.util.ReflectionTestUtils.setField(strategy, "transcriptChunkService", cache);
            CleanedNoteResponse result = strategy.processStructuredNotes(
                    transcript, "English", "Course video", true);

            assertTrue(models.size() >= 3);
            assertEquals("primary", models.get(0));
            assertTrue(models.subList(1, models.size()).stream()
                    .allMatch("fallback"::equals));
            assertTrue(result.cleanedNotes().contains("chunk 1"));
            int firstCallCount = models.size();
            strategy.processStructuredNotes(transcript, "English", "Course video", true);
            assertEquals(firstCallCount * 2, models.size());
            assertEquals("primary", models.get(firstCallCount));
            assertTrue(models.subList(firstCallCount + 1, models.size()).stream().allMatch("fallback"::equals));
        } finally {
            executor.shutdownNow();
        }
    }

}
