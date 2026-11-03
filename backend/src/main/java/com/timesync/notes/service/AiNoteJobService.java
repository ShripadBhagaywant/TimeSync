package com.timesync.notes.service;

import com.timesync.notes.dto.response.AiNoteJobResponse;
import com.timesync.notes.dto.response.ChapterDto;
import com.timesync.notes.dto.response.CleanedNoteResponse;
import com.timesync.notes.dto.response.TranscriptResponse;
import com.timesync.notes.entity.AiProcessingStatus;
import com.timesync.notes.entity.CleaningStage;
import com.timesync.notes.exception.ResourceNotFoundException;
import com.timesync.notes.exception.AiProviderQuotaException;
import com.timesync.notes.exception.AiProviderUnavailableException;
import com.timesync.notes.strategy.GeminiAiCleaningStrategy;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
public class AiNoteJobService {

    private static final int MAX_RETAINED_JOBS = 100;
    private static final Duration JOB_TTL = Duration.ofHours(2);

    private final GeminiAiCleaningStrategy aiStrategy;
    private final ExecutorService aiJobExecutor;
    private final int dailyRequestBudget;

    private final Map<String, JobState> jobs = new ConcurrentHashMap<>();
    private final AtomicInteger consumedCallBudget = new AtomicInteger();

    private volatile LocalDate budgetDate = LocalDate.now();
    private volatile Instant providerCooldownUntil = Instant.EPOCH;

    public AiNoteJobService(
            GeminiAiCleaningStrategy aiStrategy,
            @Qualifier("aiJobExecutor") ExecutorService aiJobExecutor,
            @Value("${app.gemini.daily-request-budget:15}") int dailyRequestBudget) {

        this.aiStrategy = aiStrategy;
        this.aiJobExecutor = aiJobExecutor;
        this.dailyRequestBudget = Math.max(1, dailyRequestBudget);
    }

    public Submission submit(
            TranscriptResponse baseResponse,
            String sanitizedTranscript,
            String targetLanguage) {

        cleanupExpiredJobs();

        long cooldownSeconds = activeProviderCooldownSeconds();

        if (cooldownSeconds > 0) {
            return new Submission(
                    AiProcessingStatus.SKIPPED_UNAVAILABLE,
                    null,
                    "Gemini is cooling down after a provider error. Retry in about "
                            + cooldownSeconds
                            + " seconds; your original draft is ready.",
                    Math.toIntExact(cooldownSeconds)
            );
        }

        int requiredCalls =
                aiStrategy.estimateRequiredCalls(sanitizedTranscript);

        if (requiredCalls < 1
                || !aiStrategy.isWithinRequestBudget(sanitizedTranscript)) {

            return new Submission(
                    AiProcessingStatus.SKIPPED_QUOTA,
                    null,
                    "The transcript exceeds the configured AI request budget; original-language notes are ready.",
                    null
            );
        }

        if (jobs.size() >= MAX_RETAINED_JOBS) {
            return new Submission(
                    AiProcessingStatus.SKIPPED_QUOTA,
                    null,
                    "AI job capacity is currently unavailable; original-language notes are ready.",
                    null
            );
        }

        if (!consumeCallBudget(requiredCalls)) {
            return new Submission(
                    AiProcessingStatus.SKIPPED_QUOTA,
                    null,
                    "AI daily request capacity is currently unavailable; original-language notes are ready.",
                    null
            );
        }

        String jobId = UUID.randomUUID().toString();

        String traceId =
                java.util.Optional.ofNullable(MDC.get("traceId"))
                        .orElseGet(
                                () -> UUID.randomUUID()
                                        .toString()
                                        .substring(0, 8)
                        );

        JobState state =
                new JobState(jobId, traceId, baseResponse);

        jobs.put(jobId, state);

        try {
            aiJobExecutor.execute(
                    () -> process(
                            state,
                            sanitizedTranscript,
                            targetLanguage
                    )
            );
        } catch (RejectedExecutionException ex) {

            jobs.remove(jobId);

            releaseCallBudget(requiredCalls);

            return new Submission(
                    AiProcessingStatus.SKIPPED_QUOTA,
                    null,
                    "The AI queue is busy; original-language notes are ready.",
                    null
            );
        }

        return new Submission(
                AiProcessingStatus.QUEUED,
                jobId,
                "Structured AI notes are queued.",
                null
        );
    }

    public AiNoteJobResponse get(String jobId) {

        cleanupExpiredJobs();

        JobState state = jobs.get(jobId);

        if (state == null) {
            throw new ResourceNotFoundException(
                    "AI note job was not found or has expired."
            );
        }

        return state.snapshot();
    }

    private void process(
            JobState state,
            String transcript,
            String targetLanguage) {

        long startedAt = System.nanoTime();
        try (MDC.MDCCloseable ignored =
                     MDC.putCloseable("traceId", state.traceId)) {

            state.processing();

            try {

                TranscriptResponse base =
                        state.baseResponse;

                boolean chaptersAvailable =
                        base.chapters() != null
                                && !base.chapters().isEmpty();

                CleanedNoteResponse aiResult =
                        aiStrategy.processStructuredNotes(
                                transcript,
                                targetLanguage,
                                base.title(),
                                chaptersAvailable
                        );

                if (aiResult == null || aiResult.cleanedNotes() == null || aiResult.cleanedNotes().isBlank()) {
                    throw new IllegalStateException("AI returned no generated notes.");
                }

                List<ChapterDto> chapters =
                        chaptersAvailable
                                ? base.chapters()
                                : aiResult.chapters() == null
                                ? List.of()
                                : List.copyOf(aiResult.chapters());

                TranscriptResponse completed =
                        copyWithAi(
                                base,
                                aiResult.cleanedNotes(),
                                CleaningStage.GEMINI_AI_REFINED,
                                chapters,
                                chapters.isEmpty(),
                                AiProcessingStatus.COMPLETED,
                                state.jobId,
                                "Structured notes are ready.",
                                null
                        );

                state.completed(completed);
                log.info("AI note job completed. jobId={}, elapsedMs={}", state.jobId,
                        java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt));

            } catch (AiProviderQuotaException ex) {

                extendProviderCooldown(
                        ex.getRetryAfterSeconds()
                );

                log.warn(
                        "AI note job {} paused by provider quota; original-language draft preserved. Retry after about {} second(s).",
                        state.jobId,
                        ex.getRetryAfterSeconds()
                );

                state.failed(
                        copyWithAi(
                                state.baseResponse,
                                state.baseResponse.cleanedTranscript(),
                                CleaningStage.FALLBACK_REGEX,
                                state.baseResponse.chapters(),
                                state.baseResponse.isEditableChapters(),
                                AiProcessingStatus.FAILED,
                                state.jobId,
                                "Gemini quota is temporarily exhausted. Retry in about "
                                        + ex.getRetryAfterSeconds()
                                        + " seconds; your original draft is preserved.",
                                ex.getRetryAfterSeconds()
                        )
                );

            } catch (AiProviderUnavailableException ex) {

                extendProviderCooldown(
                        ex.getRetryAfterSeconds()
                );

                log.warn(
                        "AI note job {} paused because the provider is temporarily unavailable; original-language draft preserved.",
                        state.jobId
                );

                state.failed(
                        copyWithAi(
                                state.baseResponse,
                                state.baseResponse.cleanedTranscript(),
                                CleaningStage.FALLBACK_REGEX,
                                state.baseResponse.chapters(),
                                state.baseResponse.isEditableChapters(),
                                AiProcessingStatus.FAILED,
                                state.jobId,
                                "Gemini is temporarily unavailable. Retry in about "
                                        + ex.getRetryAfterSeconds()
                                        + " seconds; your original draft is preserved.",
                                ex.getRetryAfterSeconds()
                        )
                );

            } catch (Exception ex) {

                log.error(
                        "AI note job {} failed; preserving original-language draft.",
                        state.jobId,
                        com.timesync.notes.integration.gemini.GeminiFailureLog.safeStackTrace(ex)
                );

                state.failed(
                        copyWithAi(
                                state.baseResponse,
                                state.baseResponse.cleanedTranscript(),
                                CleaningStage.FALLBACK_REGEX,
                                state.baseResponse.chapters(),
                                state.baseResponse.isEditableChapters(),
                                AiProcessingStatus.FAILED,
                                state.jobId,
                                "AI refinement was unavailable; the original-language draft is preserved.",
                                null
                        )
                );
            }
        }
    }

    private synchronized boolean consumeCallBudget(int calls) {

        resetDailyBudgetIfNeeded();

        if (consumedCallBudget.get() + calls
                > dailyRequestBudget) {
            return false;
        }

        consumedCallBudget.addAndGet(calls);

        return true;
    }

    private synchronized void releaseCallBudget(int calls) {

        resetDailyBudgetIfNeeded();

        consumedCallBudget.updateAndGet(
                current ->
                        Math.max(
                                0,
                                current - calls
                        )
        );
    }

    private void resetDailyBudgetIfNeeded() {

        LocalDate today = LocalDate.now();

        if (!today.equals(budgetDate)) {
            budgetDate = today;
            consumedCallBudget.set(0);
        }
    }

    private long activeProviderCooldownSeconds() {

        long millis =
                Duration.between(
                        Instant.now(),
                        providerCooldownUntil
                ).toMillis();

        return millis <= 0
                ? 0
                : Math.max(
                1,
                (millis + 999) / 1000
        );
    }

    private synchronized void extendProviderCooldown(
            int retryAfterSeconds) {

        Instant requestedCooldown =
                Instant.now().plusSeconds(
                        Math.max(
                                1,
                                retryAfterSeconds
                        )
                );

        if (requestedCooldown.isAfter(
                providerCooldownUntil)) {

            providerCooldownUntil =
                    requestedCooldown;
        }
    }

    private void cleanupExpiredJobs() {

        Instant cutoff =
                Instant.now().minus(JOB_TTL);

        jobs.entrySet().removeIf(
                entry ->
                        entry.getValue()
                                .updatedAt
                                .isBefore(cutoff)
        );
    }

    private TranscriptResponse copyWithAi(
            TranscriptResponse base,
            String cleanedTranscript,
            CleaningStage stage,
            List<ChapterDto> chapters,
            boolean editableChapters,
            AiProcessingStatus aiStatus,
            String aiJobId,
            String aiMessage,
            Integer retryAfterSeconds) {

        return new TranscriptResponse(
                base.videoId(),
                base.title(),
                base.channelName(),
                base.thumbnailUrl(),
                base.content(),
                base.transcriptSegments(),
                base.duration(),
                cleanedTranscript,
                stage,
                base.noteSource(),
                base.sourceDisclaimer(),
                chapters,
                editableChapters,
                base.cachedResponse(),
                base.transcriptAvailability(),
                base.transcriptLanguage(),
                base.targetLanguage(),
                true,
                retryAfterSeconds,
                base.autoGeneratedCaptions(),
                base.selectedCaptionTrackName(),
                base.availableCaptionTracks(),
                aiStatus,
                aiJobId,
                aiMessage
        ).withChapterAvailability(base.chapterAvailability()).withContentPolicy(base.contentPolicy());
    }

    public record Submission(
            AiProcessingStatus status,
            String jobId,
            String message,
            Integer retryAfterSeconds
    ) {
    }

    private static final class JobState {

        private final String jobId;
        private final String traceId;
        private final TranscriptResponse baseResponse;
        private final Instant createdAt =
                Instant.now();

        private volatile Instant updatedAt =
                createdAt;

        private volatile AiProcessingStatus status =
                AiProcessingStatus.QUEUED;

        private volatile String message =
                "Structured AI notes are queued.";

        private volatile TranscriptResponse result;

        private JobState(
                String jobId,
                String traceId,
                TranscriptResponse baseResponse) {

            this.jobId = jobId;
            this.traceId = traceId;
            this.baseResponse = baseResponse;
        }

        private synchronized void processing() {

            status =
                    AiProcessingStatus.PROCESSING;

            message =
                    "Translating and structuring the original transcript.";

            updatedAt =
                    Instant.now();
        }

        private synchronized void completed(
                TranscriptResponse result) {

            this.result = result;

            status =
                    AiProcessingStatus.COMPLETED;

            message =
                    "Structured notes are ready.";

            updatedAt =
                    Instant.now();
        }

        private synchronized void failed(
                TranscriptResponse result) {

            this.result =
                    result;

            status =
                    AiProcessingStatus.FAILED;

            message =
                    result.aiMessage();

            updatedAt =
                    Instant.now();
        }

        private synchronized AiNoteJobResponse snapshot() {

            Integer retryAfterSeconds =
                    result != null
                            ? result.retryAfterSeconds()
                            : null;

            return new AiNoteJobResponse(
                    jobId,
                    status,
                    message,
                    result,
                    retryAfterSeconds,
                    createdAt,
                    updatedAt
            );
        }
    }
}
