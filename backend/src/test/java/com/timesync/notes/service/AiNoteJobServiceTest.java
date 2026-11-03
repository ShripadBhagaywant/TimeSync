package com.timesync.notes.service;

import com.timesync.notes.dto.response.AiNoteJobResponse;
import com.timesync.notes.dto.response.ChapterDto;
import com.timesync.notes.dto.response.CleanedNoteResponse;
import com.timesync.notes.dto.response.TranscriptResponse;
import com.timesync.notes.entity.AiProcessingStatus;
import com.timesync.notes.entity.CleaningStage;
import com.timesync.notes.entity.NoteSource;
import com.timesync.notes.entity.TranscriptAvailability;
import com.timesync.notes.exception.AiProviderQuotaException;
import com.timesync.notes.exception.AiProviderUnavailableException;
import com.timesync.notes.strategy.GeminiAiCleaningStrategy;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiNoteJobServiceTest {

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.NullAndEmptySource
    @org.junit.jupiter.params.provider.ValueSource(strings = {"   "})
    void emptyAiOutputDoesNotPretendOriginalLanguageDraftWasTranslated(String generated) throws Exception {
        var strategy = mock(GeminiAiCleaningStrategy.class);
        when(strategy.estimateRequiredCalls("source")).thenReturn(1);
        when(strategy.isWithinRequestBudget("source")).thenReturn(true);
        when(strategy.processStructuredNotes("source", "Hindi", "Lesson", false))
                .thenReturn(new CleanedNoteResponse(generated, List.of()));
        var executor = Executors.newSingleThreadExecutor();
        try {
            var service = new AiNoteJobService(strategy, executor, 15);
            var source = response(List.of());
            var result = awaitFinished(service, service.submit(source, "source", "Hindi").jobId());
            assertEquals(AiProcessingStatus.FAILED, result.status());
            assertEquals(source.cleanedTranscript(), result.result().cleanedTranscript());
            assertNotEquals(CleaningStage.GEMINI_AI_REFINED, result.result().cleaningStage());
        } finally { executor.shutdownNow(); }
    }

    @Test void jobWorkerInheritsRequestTraceAndClearsItAfterCompletion() throws Exception {
        var strategy = mock(GeminiAiCleaningStrategy.class);
        when(strategy.estimateRequiredCalls("source")).thenReturn(1);
        when(strategy.isWithinRequestBudget("source")).thenReturn(true);
        var observed = new java.util.concurrent.atomic.AtomicReference<String>();
        when(strategy.processStructuredNotes(anyString(), anyString(), anyString(), anyBoolean())).thenAnswer(invocation -> {
            observed.set(org.slf4j.MDC.get("traceId"));
            return new CleanedNoteResponse("draft", List.of());
        });
        var executor = new com.timesync.notes.config.ThreadPoolConfig().aiJobExecutor(1);
        var previous = org.slf4j.MDC.getCopyOfContextMap();
        try {
            org.slf4j.MDC.put("traceId", "abc123");
            var service = new AiNoteJobService(strategy, executor, 15);
            var source = response(List.of()).withContentPolicy(com.timesync.notes.guardrail.ContentPolicyDecision.semantic(
                    com.timesync.notes.entity.ContentEligibility.INFORMATIONAL));
            var submission = service.submit(source, "source", "English");
            var finished = awaitFinished(service, submission.jobId());
            assertEquals(AiProcessingStatus.COMPLETED, finished.status());
            assertEquals(source.contentEligibility(), finished.result().contentEligibility());
            assertEquals(source.verificationLevel(), finished.result().verificationLevel());
            assertEquals(source.contentReasonCode(), finished.result().contentReasonCode());
            assertEquals("abc123", observed.get());
            assertEquals("abc123", org.slf4j.MDC.get("traceId"));
            assertNull(executor.submit(() -> org.slf4j.MDC.get("traceId")).get());
        } finally {
            executor.shutdownNow();
            if (previous == null) org.slf4j.MDC.clear(); else org.slf4j.MDC.setContextMap(previous);
        }
    }

    @Test
    void preservesNativeChaptersAndCompletesStructuredDraftInBackground()
            throws Exception {

        GeminiAiCleaningStrategy strategy =
                mock(GeminiAiCleaningStrategy.class);

        when(strategy.estimateRequiredCalls("clean transcript"))
                .thenReturn(1);

        when(strategy.isWithinRequestBudget("clean transcript"))
                .thenReturn(true);

        when(strategy.processStructuredNotes(
                "clean transcript",
                "Hindi",
                "Lesson",
                true
        )).thenReturn(
                new CleanedNoteResponse(
                        "## संरचित नोट्स",
                        List.of(
                                new ChapterDto(
                                        "AI chapter",
                                        0,
                                        "00:00"
                                )
                        )
                )
        );

        ExecutorService executor =
                Executors.newSingleThreadExecutor();

        try {
            AiNoteJobService service =
                    new AiNoteJobService(
                            strategy,
                            executor,
                            15
                    );

            ChapterDto nativeChapter =
                    new ChapterDto(
                            "Native chapter",
                            0,
                            "00:00"
                    );

            AiNoteJobService.Submission submission =
                    service.submit(
                            response(List.of(nativeChapter)),
                            "clean transcript",
                            "Hindi"
                    );

            assertEquals(
                    AiProcessingStatus.QUEUED,
                    submission.status()
            );

            assertNotNull(submission.jobId());
            assertNull(submission.retryAfterSeconds());

            AiNoteJobResponse job =
                    awaitFinished(
                            service,
                            submission.jobId()
                    );

            assertEquals(
                    AiProcessingStatus.COMPLETED,
                    job.status()
            );

            assertNotNull(job.result());
            assertEquals("Hindi", job.result().targetLanguage());

            assertEquals(
                    "## संरचित नोट्स",
                    job.result().cleanedTranscript()
            );

            assertEquals(
                    List.of(nativeChapter),
                    job.result().chapters()
            );

            assertFalse(
                    job.result().isEditableChapters()
            );

            /*
             * A successful job must not carry stale provider
             * cooldown information.
             */
            assertNull(job.retryAfterSeconds());
            assertNull(
                    job.result().retryAfterSeconds()
            );

            verify(strategy).processStructuredNotes(
                    "clean transcript",
                    "Hindi",
                    "Lesson",
                    true
            );

        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void skipsAiWhenTranscriptExceedsRequestBudget() {

        GeminiAiCleaningStrategy strategy =
                mock(GeminiAiCleaningStrategy.class);

        when(strategy.estimateRequiredCalls("large"))
                .thenReturn(4);

        when(strategy.isWithinRequestBudget("large"))
                .thenReturn(false);

        ExecutorService executor =
                Executors.newSingleThreadExecutor();

        try {
            AiNoteJobService service =
                    new AiNoteJobService(
                            strategy,
                            executor,
                            15
                    );

            AiNoteJobService.Submission submission =
                    service.submit(
                            response(List.of()),
                            "large",
                            "English"
                    );

            assertEquals(
                    AiProcessingStatus.SKIPPED_QUOTA,
                    submission.status()
            );

            assertNull(submission.jobId());
            assertNull(submission.retryAfterSeconds());

            verify(
                    strategy,
                    never()
            ).processStructuredNotes(
                    anyString(),
                    anyString(),
                    anyString(),
                    anyBoolean()
            );

        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void reportsProviderQuotaWithStructuredRetryAfterAndPreservesOriginalDraft()
            throws Exception {

        GeminiAiCleaningStrategy strategy =
                mock(GeminiAiCleaningStrategy.class);

        when(strategy.estimateRequiredCalls(
                "clean transcript"
        )).thenReturn(1);

        when(strategy.isWithinRequestBudget(
                "clean transcript"
        )).thenReturn(true);

        when(strategy.processStructuredNotes(
                "clean transcript",
                "English",
                "Lesson",
                false
        )).thenThrow(
                new AiProviderQuotaException(
                        "quota",
                        new RuntimeException("429"),
                        45
                )
        );

        ExecutorService executor =
                Executors.newSingleThreadExecutor();

        try {
            AiNoteJobService service =
                    new AiNoteJobService(
                            strategy,
                            executor,
                            15
                    );

            AiNoteJobService.Submission submission =
                    service.submit(
                            response(List.of()),
                            "clean transcript",
                            "English"
                    );

            assertEquals(
                    AiProcessingStatus.QUEUED,
                    submission.status()
            );

            assertNotNull(submission.jobId());
            assertNull(submission.retryAfterSeconds());

            AiNoteJobResponse job =
                    awaitFinished(
                            service,
                            submission.jobId()
                    );

            assertEquals(
                    AiProcessingStatus.FAILED,
                    job.status()
            );

            assertNotNull(job.result());

            /*
             * AI failure must preserve the original
             * non-AI draft.
             */
            assertEquals(
                    "Original draft",
                    job.result().cleanedTranscript()
            );

            /*
             * Structured retry timing must exist both
             * at the job level and inside the result.
             */
            assertEquals(
                    45,
                    job.retryAfterSeconds()
            );

            assertEquals(
                    45,
                    job.result().retryAfterSeconds()
            );

            assertTrue(
                    job.message().contains(
                            "45 seconds"
                    )
            );

            /*
             * Immediate retry during cooldown should not
             * invoke Gemini again.
             */
            AiNoteJobService.Submission immediateRetry =
                    service.submit(
                            response(List.of()),
                            "clean transcript",
                            "English"
                    );

            assertEquals(
                    AiProcessingStatus.SKIPPED_UNAVAILABLE,
                    immediateRetry.status()
            );

            assertNull(immediateRetry.jobId());

            assertNotNull(
                    immediateRetry.retryAfterSeconds()
            );

            assertTrue(
                    immediateRetry.retryAfterSeconds() > 0
            );

            assertTrue(
                    immediateRetry.retryAfterSeconds() <= 45
            );

            assertTrue(
                    immediateRetry.message()
                            .contains("cooling down")
            );

            verify(
                    strategy,
                    times(1)
            ).processStructuredNotes(
                    "clean transcript",
                    "English",
                    "Lesson",
                    false
            );

        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void reportsProviderUnavailableWithStructuredRetryAfterAndPreservesOriginalDraft()
            throws Exception {

        GeminiAiCleaningStrategy strategy =
                mock(GeminiAiCleaningStrategy.class);

        when(strategy.estimateRequiredCalls(
                "clean transcript"
        )).thenReturn(1);

        when(strategy.isWithinRequestBudget(
                "clean transcript"
        )).thenReturn(true);

        when(strategy.processStructuredNotes(
                "clean transcript",
                "English",
                "Lesson",
                false
        )).thenThrow(
                new AiProviderUnavailableException(
                        "high demand",
                        new RuntimeException("503"),
                        30
                )
        );

        ExecutorService executor =
                Executors.newSingleThreadExecutor();

        try {
            AiNoteJobService service =
                    new AiNoteJobService(
                            strategy,
                            executor,
                            15
                    );

            AiNoteJobService.Submission submission =
                    service.submit(
                            response(List.of()),
                            "clean transcript",
                            "English"
                    );

            assertEquals(
                    AiProcessingStatus.QUEUED,
                    submission.status()
            );

            assertNotNull(submission.jobId());

            AiNoteJobResponse job =
                    awaitFinished(
                            service,
                            submission.jobId()
                    );

            assertEquals(
                    AiProcessingStatus.FAILED,
                    job.status()
            );

            assertNotNull(job.result());

            assertEquals(
                    "Original draft",
                    job.result().cleanedTranscript()
            );

            assertEquals(
                    30,
                    job.retryAfterSeconds()
            );

            assertEquals(
                    30,
                    job.result().retryAfterSeconds()
            );

            assertTrue(
                    job.message()
                            .contains("temporarily unavailable")
            );

            /*
             * Provider should now be cooling down.
             */
            AiNoteJobService.Submission retry =
                    service.submit(
                            response(List.of()),
                            "clean transcript",
                            "English"
                    );

            assertEquals(
                    AiProcessingStatus.SKIPPED_UNAVAILABLE,
                    retry.status()
            );

            assertNull(retry.jobId());

            assertNotNull(
                    retry.retryAfterSeconds()
            );

            assertTrue(
                    retry.retryAfterSeconds() > 0
            );

            assertTrue(
                    retry.retryAfterSeconds() <= 30
            );

            /*
             * No second Gemini request during cooldown.
             */
            verify(
                    strategy,
                    times(1)
            ).processStructuredNotes(
                    "clean transcript",
                    "English",
                    "Lesson",
                    false
            );

        } finally {
            executor.shutdownNow();
        }
    }

    private AiNoteJobResponse awaitFinished(
            AiNoteJobService service,
            String jobId
    ) throws Exception {

        assertNotNull(
                jobId,
                "Expected queued AI job to have an ID"
        );

        for (int attempt = 0; attempt < 50; attempt++) {

            AiNoteJobResponse job =
                    service.get(jobId);

            if (job.status() ==
                    AiProcessingStatus.COMPLETED
                    || job.status() ==
                    AiProcessingStatus.FAILED) {

                return job;
            }

            Thread.sleep(10);
        }

        fail("AI job did not finish");

        return null;
    }

    private TranscriptResponse response(
            List<ChapterDto> chapters
    ) {

        return new TranscriptResponse(
                "abcdefghijk",
                "Lesson",
                "Channel",
                "",
                "raw",
                List.of(),
                "10:00",
                "Original draft",
                CleaningStage.REGEX_SANITIZED,
                NoteSource.CAPTIONS,
                "",
                chapters,
                chapters.isEmpty(),
                false,
                TranscriptAvailability.AVAILABLE,
                "en",
                "Hindi",
                true,
                null
        );
    }
}
