package com.timesync.notes.integration.gemini;

import com.timesync.notes.dto.response.CleanedNoteResponse;
import com.timesync.notes.util.SpringAiPromptEscaper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatOptions;
import static com.timesync.notes.integration.gemini.GeminiFailureMapper.quotaException;
import static com.timesync.notes.integration.gemini.GeminiFailureMapper.unavailableException;
import static com.timesync.notes.integration.gemini.GeminiFailureMapper.shouldUseFallback;
import static com.timesync.notes.integration.gemini.GeminiFailureLog.safeStackTrace;

/** Builds the existing prompt and executes a single provider request. */
@Slf4j
public final class GeminiChunkClient {
    private final ChatClient chatClient;
    private final String promptTemplate;

    public GeminiChunkClient(ChatClient chatClient, String promptTemplate) {
        this.chatClient = chatClient;
        this.promptTemplate = promptTemplate;
    }

    public CleanedNoteResponse process(
            String chunk,
            int chunkIndex,
            int totalChunks,
            String videoTitle,
            String targetLanguage,
            boolean chaptersAlreadyAvailable,
            String model) {

        log.debug(
                "Dispatching AI chunk {}/{} for video '{}' "
                        + "using model '{}'; payload size={} characters.",
                chunkIndex,
                totalChunks,
                videoTitle,
                model,
                chunk.length()
        );

        String chapterInstruction =
                chaptersAlreadyAvailable

                        ? "Creator or user chapters already exist. "
                        + "Do not generate chapters; return an empty chapters "
                        + "array and focus only on structured notes."

                        : "No chapters are available. Generate chapters "
                        + "only for clear topic shifts.";

        String resolvedPrompt =
                promptTemplate

                        .replace(
                                "{videoTitle}",
                                safePromptValue(videoTitle)
                        )

                        .replace(
                                "{targetLanguage}",
                                safePromptValue(targetLanguage)
                        )

                        .replace(
                                "{chunkIndex}",
                                Integer.toString(chunkIndex)
                        )

                        .replace(
                                "{totalChunks}",
                                Integer.toString(totalChunks)
                        )

                        .replace(
                                "{chapterGenerationInstruction}",
                                chapterInstruction
                        )

                        .replace(
                                "{transcriptChunk}",
                                chunk
                        );

        OpenAiChatOptions options =
                OpenAiChatOptions.builder()
                        .model(model)
                        .build();

        try {

            CleanedNoteResponse response =
                    chatClient
                            .prompt(
                                    new Prompt(
                                            SpringAiPromptEscaper
                                                    .escapeLiteralBraces(
                                                            resolvedPrompt
                                                    ),
                                            options
                                    )
                            )
                            .call()
                            .entity(
                                    CleanedNoteResponse.class
                            );

            if (response == null) {

                throw new IllegalStateException(
                        "Gemini returned an empty structured response."
                );
            }

            return response;

        } catch (RuntimeException ex) {

            var quota = quotaException(ex);
            var unavailable = unavailableException(ex);
            if (quota != null) {
                log.warn("Gemini provider quota/rate limit for chunk {}/{}. model={}, retryAfterSeconds={}",
                        chunkIndex, totalChunks, model, quota.getRetryAfterSeconds());
            } else if (unavailable != null) {
                log.warn("Gemini provider temporarily unavailable for chunk {}/{}. model={}, retryAfterSeconds={}",
                        chunkIndex, totalChunks, model, unavailable.getRetryAfterSeconds());
            } else if (shouldUseFallback(ex)) {
                log.warn("Gemini model unavailable for chunk {}/{}. model={}, fallbackEligible=true",
                        chunkIndex, totalChunks, model);
            } else {
                log.error("Unexpected Gemini failure for chunk {}/{}. model={}, errorType={}",
                        chunkIndex, totalChunks, model, ex.getClass().getSimpleName(), safeStackTrace(ex));
            }

            throw ex;
        }
    }

    private String safePromptValue(
            String value) {

        return value == null || value.isBlank()
                ? "Not provided"
                : value.trim();
    }

}
