package com.timesync.notes.strategy;

import static com.timesync.notes.integration.gemini.GeminiFailureMapper.quotaException;
import static com.timesync.notes.integration.gemini.GeminiFailureLog.safeStackTrace;
import static com.timesync.notes.integration.gemini.GeminiFailureMapper.shouldUseFallback;
import static com.timesync.notes.integration.gemini.GeminiFailureMapper.unavailableException;

import com.timesync.notes.dto.response.CleanedNoteResponse;
import com.timesync.notes.exception.AiProviderQuotaException;
import com.timesync.notes.exception.AiProviderUnavailableException;
import com.timesync.notes.exception.ApiException;
import com.timesync.notes.integration.gemini.GeminiChunkClient;
import com.timesync.notes.service.TranscriptChunkService;
import com.timesync.notes.util.TranscriptChunker;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class GeminiAiCleaningStrategy {

    private static final long MIN_PROCESSING_TIMEOUT_SECONDS = 30L;
    private static final String DEFAULT_PRIMARY_MODEL = "gemini-3.8-flash";
    private static final String DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

    private final ExecutorService executorService;
    private final long processingTimeoutSeconds;
    private final String primaryModel;
    private final String fallbackModel;
    private final ModelChunkProcessor modelChunkProcessor;

    private StructuredNoteMerger structuredNoteMerger = new StructuredNoteMerger();
    private AiOutputSanitizer aiOutputSanitizer = new AiOutputSanitizer();

    /*
     * Preserved for the package-private/test constructor path.
     * Spring replaces this with the real bean in the @Autowired constructor.
     */
    private TranscriptChunkService transcriptChunkService = new TranscriptChunkService(null);

    public GeminiAiCleaningStrategy(
            ChatClient chatClient,
            @Qualifier("aiChunkExecutor") ExecutorService executorService,
            @Value("${app.gemini.prompt-template}") String promptTemplate,
            @Value("${app.gemini.processing-timeout-seconds:300}") long processingTimeoutSeconds,
            @Value("${spring.ai.openai.chat.options.model:gemini-3.8-flash}") String primaryModel,
            @Value("${app.gemini.fallback-model:gemini-3.5-flash-lite}") String fallbackModel) {

        this(
                chatClient,
                executorService,
                promptTemplate,
                processingTimeoutSeconds,
                primaryModel,
                fallbackModel,
                null
        );
    }

    @Autowired
    public GeminiAiCleaningStrategy(
            ChatClient chatClient,
            @Qualifier("aiChunkExecutor") ExecutorService executorService,
            @Value("${app.gemini.prompt-template}") String promptTemplate,
            @Value("${app.gemini.processing-timeout-seconds:300}") long processingTimeoutSeconds,
            @Value("${spring.ai.openai.chat.options.model:gemini-3.8-flash}") String primaryModel,
            @Value("${app.gemini.fallback-model:gemini-3.5-flash-lite}") String fallbackModel,
            StructuredNoteMerger structuredNoteMerger,
            AiOutputSanitizer aiOutputSanitizer,
            TranscriptChunkService transcriptChunkService) {

        this(
                chatClient,
                executorService,
                promptTemplate,
                processingTimeoutSeconds,
                primaryModel,
                fallbackModel
        );

        this.structuredNoteMerger = structuredNoteMerger;
        this.aiOutputSanitizer = aiOutputSanitizer;
        this.transcriptChunkService = transcriptChunkService;
    }

    GeminiAiCleaningStrategy(
            ChatClient chatClient,
            ExecutorService executorService,
            String promptTemplate,
            long processingTimeoutSeconds,
            String primaryModel,
            String fallbackModel,
            ModelChunkProcessor modelChunkProcessor) {

        this.executorService = executorService;
        this.processingTimeoutSeconds =
                Math.max(MIN_PROCESSING_TIMEOUT_SECONDS, processingTimeoutSeconds);

        this.primaryModel =
                normalizedModel(primaryModel, DEFAULT_PRIMARY_MODEL);

        this.fallbackModel =
                normalizedModel(fallbackModel, DEFAULT_FALLBACK_MODEL);

        this.modelChunkProcessor = modelChunkProcessor == null
                ? new GeminiChunkClient(chatClient, promptTemplate)::process
                : modelChunkProcessor;
    }

    public CleanedNoteResponse processStructuredNotes(
            String rawTranscript,
            String targetLanguage,
            String videoTitle,
            boolean chaptersAlreadyAvailable) {

        return aiOutputSanitizer.sanitize(
                structuredNoteMerger.merge(
                        processChunks(
                                rawTranscript,
                                targetLanguage,
                                videoTitle,
                                chaptersAlreadyAvailable
                        )
                ),
                targetLanguage
        );
    }

    public List<CleanedNoteResponse> processChunks(
            String rawTranscript,
            String targetLanguage,
            String videoTitle,
            boolean chaptersAlreadyAvailable) {

        if (rawTranscript == null || rawTranscript.isBlank()) {
            return List.of();
        }

        if (!TranscriptChunker.isWithinAiBudget(rawTranscript)) {
            throw new ApiException(
                    "Transcript exceeds the configured AI request budget.",
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "AI_TRANSCRIPT_TOO_LARGE"
            );
        }

        List<String> chunks =
                transcriptChunkService.getOrCreate(rawTranscript).chunks();

        int totalChunks = chunks.size();

        log.info(
                "Processing {} transcript chunk(s) with bounded AI concurrency "
                        + "for video: '{}'",
                totalChunks,
                videoTitle
        );

        List<CleanedNoteResponse> chunkResults = new ArrayList<>();
        boolean fallbackIsSticky = false;

        /*
         * Overall deadline for the complete AI refinement job.
         *
         * Individual chunk requests share this deadline rather than each
         * receiving the entire configured timeout independently.
         */
        long deadlineNanos =
                System.nanoTime()
                        + TimeUnit.SECONDS.toNanos(processingTimeoutSeconds);

        try {

            /*
             * Chunks remain sequential by design.
             *
             * This allows provider/quota failures to stop future requests
             * immediately and preserves the existing sticky-fallback behavior.
             */
            for (int index = 0; index < totalChunks; index++) {

                final int chunkIndex = index + 1;
                final String currentChunk = chunks.get(index);

                long remainingNanos =
                        deadlineNanos - System.nanoTime();

                if (remainingNanos <= 0) {
                    throw new TimeoutException(
                            "AI transcript processing exceeded the configured "
                                    + "timeout of "
                                    + processingTimeoutSeconds
                                    + " seconds."
                    );
                }

                log.debug(
                        "Submitting AI chunk {}/{}; chunk size={} characters; "
                                + "remaining job timeout={} seconds.",
                        chunkIndex,
                        totalChunks,
                        currentChunk.length(),
                        TimeUnit.NANOSECONDS.toSeconds(remainingNanos)
                );

                final boolean useFallbackOnly = fallbackIsSticky;

                /*
                 * Capture the caller MDC before handing work to the pooled
                 * ai-chunk worker. Without this, TraceID is lost and logs from
                 * GeminiChunkClient appear with TraceID=N/A.
                 */
                Future<ChunkProcessingResult> future =
                        submitWithMdc(
                                () -> processChunkWithModelFallback(
                                        currentChunk,
                                        chunkIndex,
                                        totalChunks,
                                        videoTitle,
                                        targetLanguage,
                                        chaptersAlreadyAvailable,
                                        useFallbackOnly
                                )
                        );

                ChunkProcessingResult processingResult;

                try {

                    processingResult = future.get(
                            remainingNanos,
                            TimeUnit.NANOSECONDS
                    );

                } catch (TimeoutException ex) {

                    /*
                     * Future.get(timeout) does not cancel the running worker.
                     * Explicit cancellation prevents an outbound model request
                     * from continuing after the job has timed out.
                     */
                    boolean cancelled = future.cancel(true);

                    log.error(
                            "AI chunk {}/{} timed out for video '{}'. "
                                    + "Worker cancellation requested: {}.",
                            chunkIndex,
                            totalChunks,
                            videoTitle,
                            cancelled
                    );

                    throw new TimeoutException(
                            "AI transcript processing exceeded the configured "
                                    + "timeout of "
                                    + processingTimeoutSeconds
                                    + " seconds."
                    );

                } catch (InterruptedException ex) {

                    future.cancel(true);
                    Thread.currentThread().interrupt();
                    throw ex;
                }

                if (processingResult == null
                        || processingResult.response() == null) {

                    log.warn(
                            "Gemini returned no result for chunk {}/{} of '{}'.",
                            chunkIndex,
                            totalChunks,
                            videoTitle
                    );

                    continue;
                }

                fallbackIsSticky =
                        fallbackIsSticky || processingResult.usedFallback();

                CleanedNoteResponse chunkResult =
                        processingResult.response();

                chunkResults.add(
                        chaptersAlreadyAvailable
                                ? new CleanedNoteResponse(
                                chunkResult.cleanedNotes(),
                                List.of()
                        )
                                : chunkResult
                );
            }

        } catch (InterruptedException ex) {

            Thread.currentThread().interrupt();

            log.error(
                    "AI chunk processing was interrupted for video '{}'.",
                    videoTitle,
                    ex
            );

            throw new ApiException(
                    "AI chunk processing was interrupted.",
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "PROCESSING_INTERRUPTED"
            );

        } catch (TimeoutException ex) {

            log.error(
                    "AI refinement timed out after {} seconds for video '{}'.",
                    processingTimeoutSeconds,
                    videoTitle,
                    ex
            );

            throw new ApiException(
                    "AI processing exceeded the configured timeout. "
                            + "Please try again.",
                    HttpStatus.GATEWAY_TIMEOUT,
                    "AI_PROCESSING_TIMEOUT"
            );

        } catch (Exception ex) {

            AiProviderQuotaException quota =
                    quotaException(ex);

            if (quota != null) {

                log.warn(
                        "AI provider quota reached for '{}'; "
                                + "stopped remaining chunks. "
                                + "Retry after about {} second(s).",
                        videoTitle,
                        quota.getRetryAfterSeconds()
                );

                throw quota;
            }

            AiProviderUnavailableException unavailable =
                    unavailableException(ex);

            if (unavailable != null) {

                /*
                 * Provider unavailability is an expected, retryable runtime
                 * condition. Keep it concise here; do not add a second stack
                 * trace after the lower layer has already classified it.
                 */
                log.warn(
                        "AI provider remains unavailable for '{}'; "
                                + "stopped remaining chunks. "
                                + "Retry after about {} second(s).",
                        videoTitle,
                        unavailable.getRetryAfterSeconds()
                );

                throw unavailable;
            }

            /*
             * Unexpected execution failures still retain a stack trace because
             * these require engineering investigation.
             */
            log.error(
                    "Unexpected Gemini AI execution failure. errorType={}",
                    ex.getClass().getSimpleName(),
                    safeStackTrace(ex)
            );

            throw new ApiException(
                    "AI processing service is temporarily unavailable. "
                            + "Please try again.",
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "AI_SERVICE_ERROR"
            );
        }

        return List.copyOf(chunkResults);
    }

    private ChunkProcessingResult processChunkWithModelFallback(
            String chunk,
            int chunkIndex,
            int totalChunks,
            String videoTitle,
            String targetLanguage,
            boolean chaptersAlreadyAvailable,
            boolean useFallbackOnly) {

        if (useFallbackOnly) {
            return new ChunkProcessingResult(
                    modelChunkProcessor.process(
                            chunk,
                            chunkIndex,
                            totalChunks,
                            videoTitle,
                            targetLanguage,
                            chaptersAlreadyAvailable,
                            fallbackModel
                    ),
                    true
            );
        }

        try {

            return new ChunkProcessingResult(
                    modelChunkProcessor.process(
                            chunk,
                            chunkIndex,
                            totalChunks,
                            videoTitle,
                            targetLanguage,
                            chaptersAlreadyAvailable,
                            primaryModel
                    ),
                    false
            );

        } catch (RuntimeException ex) {

            if (!shouldUseFallback(ex)
                    || primaryModel.equals(fallbackModel)) {

                throw ex;
            }

            /*
             * A provider-capacity/model-unavailable condition is expected
             * fallback behavior, not an application failure. Log the decision
             * concisely and let the fallback model continue the job.
             */
            log.warn(
                    "Primary Gemini model '{}' unavailable for '{}'; "
                            + "switching to fallback model '{}' at chunk {}/{}.",
                    primaryModel,
                    videoTitle,
                    fallbackModel,
                    chunkIndex,
                    totalChunks
            );

            return new ChunkProcessingResult(
                    modelChunkProcessor.process(
                            chunk,
                            chunkIndex,
                            totalChunks,
                            videoTitle,
                            targetLanguage,
                            chaptersAlreadyAvailable,
                            fallbackModel
                    ),
                    true
            );
        }
    }

    public int estimateRequiredCalls(String transcript) {

        int chunks =
                TranscriptChunker.estimateRequiredChunks(transcript);

        return chunks > 0 && !primaryModel.equals(fallbackModel)
                ? chunks + 1
                : chunks;
    }

    public boolean isWithinRequestBudget(String transcript) {

        return TranscriptChunker.isWithinAiBudget(transcript);
    }

    private String normalizedModel(
            String value,
            String fallback) {

        return value == null || value.isBlank()
                ? fallback
                : value.trim();
    }

    /**
     * Submits work while preserving the caller's SLF4J MDC context.
     *
     * Executor threads are reused, so the previous worker context is restored
     * in finally to prevent trace data leaking between unrelated jobs.
     */
    private <T> Future<T> submitWithMdc(Supplier<T> task) {

        Map<String, String> callerContext =
                MDC.getCopyOfContextMap();

        return executorService.submit(() -> {

            Map<String, String> workerPreviousContext =
                    MDC.getCopyOfContextMap();

            try {

                applyMdc(callerContext);
                return task.get();

            } finally {

                applyMdc(workerPreviousContext);
            }
        });
    }

    private void applyMdc(Map<String, String> context) {

        if (context == null || context.isEmpty()) {
            MDC.clear();
            return;
        }

        MDC.setContextMap(context);
    }

    private record ChunkProcessingResult(
            CleanedNoteResponse response,
            boolean usedFallback) {
    }

    @FunctionalInterface
    interface ModelChunkProcessor {

        CleanedNoteResponse process(
                String chunk,
                int chunkIndex,
                int totalChunks,
                String videoTitle,
                String targetLanguage,
                boolean chaptersAlreadyAvailable,
                String model
        );
    }
}
