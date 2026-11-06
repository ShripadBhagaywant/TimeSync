package com.timesync.notes.guardrail;

import com.timesync.notes.dto.response.EducationalEvaluationResult;
import com.timesync.notes.entity.ContentEligibility;
import com.timesync.notes.exception.NonEducationalContentException;
import com.timesync.notes.exception.AiProviderUnavailableException;
import com.timesync.notes.exception.AiProviderQuotaException;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;

import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class EducationalContentClassifierTest {

    private ChatClient chatClient;

    private EducationalContentClassifier classifier;

    @Test
    void identicalVerifiedEvidenceAvoidsAnotherProviderCall() {
        mockAiResult(new EducationalEvaluationResult(ContentEligibility.EDUCATIONAL, "PROGRAMMING", "Teaches Docker"));
        var request = chatClient.prompt();
        org.mockito.Mockito.clearInvocations(chatClient, request);
        classifier.validateEducationalContent("Docker", "Teacher", "27", "Docker containers tutorial", "en");
        classifier.validateEducationalContent("Docker", "Teacher", "27", "Docker containers tutorial", "en");
        org.mockito.Mockito.verify(chatClient, org.mockito.Mockito.times(1)).prompt();
        var options = org.mockito.ArgumentCaptor.forClass(org.springframework.ai.chat.prompt.ChatOptions.class);
        org.mockito.Mockito.verify(request).options(options.capture());
        assertEquals("low", ((org.springframework.ai.openai.OpenAiChatOptions) options.getValue()).getReasoningEffort());
    }

    @Test
    void changedEvidenceOutsideSampleAndChangedMetadataRequireVerification() {
        mockAiResult(new EducationalEvaluationResult(ContentEligibility.EDUCATIONAL, "PROGRAMMING", "Teaches Docker"));
        org.mockito.Mockito.clearInvocations(chatClient);
        String transcript = "a".repeat(8000);
        classifier.validateEducationalContent("Docker", "Teacher", "27", transcript, "en");
        String changed = transcript.substring(0, 1500) + "b" + transcript.substring(1501);
        classifier.validateEducationalContent("Docker", "Teacher", "27", changed, "en");
        classifier.validateEducationalContent("Other title", "Teacher", "27", changed, "en");
        org.mockito.Mockito.verify(chatClient, org.mockito.Mockito.times(3)).prompt();
    }

    @Test
    void temporaryProviderFailureIsNotCached() {
        mockAiFailure(new IllegalStateException("Temporarily unavailable"));
        org.mockito.Mockito.clearInvocations(chatClient);
        for (int attempt = 0; attempt < 2; attempt++) {
            assertThrows(AiProviderUnavailableException.class, () -> classifier.validateEducationalContent(
                    "Docker", "Teacher", "27", "Docker containers tutorial", "en"));
        }
        org.mockito.Mockito.verify(chatClient, org.mockito.Mockito.times(2)).prompt();
    }

    @BeforeEach
    void setUp() {

        chatClient = mock(
                ChatClient.class,
                RETURNS_DEEP_STUBS
        );

        classifier =
                new EducationalContentClassifier(chatClient);
    }

    @Test
    void rejectsMusicCategoryBeforeAiProcessing() {

        assertThrows(
                NonEducationalContentException.class,
                () -> classifier.validateEducationalContent(
                        "Yeshanagula | The Paradise | Nani | Keerthy Suresh",
                        "Saregama Telugu",
                        "10",
                        "This is some transcript text.",
                        "English"
                )
        );

        /*
         * Category 10 = Music.
         *
         * Metadata rejection should happen before Gemini is called.
         */
        verifyNoInteractions(chatClient);
    }

    @Test
    void rejectsExplicitMusicVideoTitleBeforeAiProcessing() {

        assertThrows(
                NonEducationalContentException.class,
                () -> classifier.validateEducationalContent(
                        "Amazing Song Official Music Video",
                        "Example Records",
                        "",
                        "Some transcript text.",
                        "English"
                )
        );

        verifyNoInteractions(chatClient);
    }

    @Test
    void rejectsEntertainmentCategoryBeforeAiProcessing() {

        assertThrows(
                NonEducationalContentException.class,
                () -> classifier.validateEducationalContent(
                        "Celebrity Fun Compilation",
                        "Example Entertainment",
                        "24",
                        "Some transcript text.",
                        "English"
                )
        );

        verifyNoInteractions(chatClient);
    }

    @Test
    void allowsEducationalContentWhenAiClassifiesEducational() {

        mockAiResult(
                new EducationalEvaluationResult(
                        ContentEligibility.EDUCATIONAL,
                        "PROGRAMMING_TUTORIAL",
                        "The video teaches Spring Boot concepts."
                )
        );

        assertDoesNotThrow(
                () -> classifier.validateEducationalContent(
                        "Spring Boot REST API Tutorial",
                        "Learn Code With Durgesh",
                        "27",
                        """
                        In this tutorial we are going to learn how to create
                        REST APIs using Spring Boot. We will create controllers,
                        services, repositories, and connect our application
                        with a database.
                        """,
                        "English"
                )
        );
    }

    @Test
    void allowsInformationalContent() {

        mockAiResult(
                new EducationalEvaluationResult(
                        ContentEligibility.INFORMATIONAL,
                        "SYSTEM_DESIGN",
                        "The video provides an in-depth technical explanation."
                )
        );

        assertDoesNotThrow(
                () -> classifier.validateEducationalContent(
                        "How Netflix Handles Millions of Requests",
                        "Engineering Channel",
                        "28",
                        """
                        Netflix operates a globally distributed architecture.
                        In this discussion we examine load balancing,
                        microservices, caching, databases and fault tolerance.
                        """,
                        "English"
                )
        );
    }

    @Test
    void rejectsContentWhenAiClassifiesEntertainment() {

        mockAiResult(
                new EducationalEvaluationResult(
                        ContentEligibility.ENTERTAINMENT,
                        "GAMING_ENTERTAINMENT",
                        "The primary purpose is gameplay entertainment."
                )
        );

        assertThrows(
                NonEducationalContentException.class,
                () -> classifier.validateEducationalContent(
                        "Playing With Friends Tonight",
                        "Gaming Channel",
                        "",
                        """
                        Hey everyone, welcome back. Today we're playing
                        another match with friends and having some fun.
                        """,
                        "English"
                )
        );
    }

    @Test
    void rejectsMovieDiscussionWhenModelLabelConflictsWithItsEntertainmentEvidence() {
        mockAiResult(new EducationalEvaluationResult(
                ContentEligibility.EDUCATIONAL,
                "MOVIE_DISCUSSION",
                "Commentary and audience reaction to a movie producer's adaptation choices."
        ));

        assertThrows(NonEducationalContentException.class, () -> classifier.validateEducationalContent(
                "RAMAYANA Part 1: Discussion - Namit Malhotra Really Cooked??",
                "Mr. Super Lad",
                "",
                "A creator discusses a movie adaptation, producer choices, and audience reactions.",
                "English"
        ));
    }

    @Test
    void acceptsFactualFilmHistoryDespiteMediaSubject() {
        mockAiResult(new EducationalEvaluationResult(
                ContentEligibility.INFORMATIONAL,
                "FILM_HISTORY",
                "Historical analysis of how cinema technology developed."
        ));

        assertDoesNotThrow(() -> classifier.validateEducationalContent(
                "A History of Film Technology",
                "Documentary Channel",
                "",
                "This documentary explains the history of film technology.",
                "English"
        ));
    }

    @Test
    void rejectsUnknownClassification() {

        mockAiResult(
                new EducationalEvaluationResult(
                        ContentEligibility.UNKNOWN,
                        "AMBIGUOUS",
                        "There is not enough evidence to determine the primary purpose."
                )
        );

        assertThrows(
                NonEducationalContentException.class,
                () -> classifier.validateEducationalContent(
                        "Interesting Video",
                        "Some Channel",
                        "",
                        """
                        Welcome everyone. Today we're going to talk about
                        several different things.
                        """,
                        "English"
                )
        );
    }

    @Test
    void rejectsWhenTranscriptIsEmpty() {

        assertThrows(
                NonEducationalContentException.class,
                () -> classifier.validateEducationalContent(
                        "Understanding Distributed Systems",
                        "Engineering Channel",
                        "28",
                        "",
                        "English"
                )
        );

        /*
         * Empty transcript means semantic classification cannot
         * safely be performed.
         */
        verifyNoInteractions(chatClient);
    }

    @Test
    void rejectsWhenTranscriptIsNull() {

        assertThrows(
                NonEducationalContentException.class,
                () -> classifier.validateEducationalContent(
                        "Understanding Distributed Systems",
                        "Engineering Channel",
                        "28",
                        null,
                        "English"
                )
        );

        verifyNoInteractions(chatClient);
    }

    @Test
    void unexpectedExecutionFailureIsUnavailableRatherThanSemanticRejection() {
        mockAiFailure(new IllegalStateException("private provider payload"));
        var failure = assertThrows(AiProviderUnavailableException.class, this::verifyLesson);
        assertEquals("AI_PROVIDER_UNAVAILABLE", failure.getErrorCode());
        assertEquals(30, failure.getRetryAfterSeconds());
        assertFalse(failure.getMessage().contains("private"));
    }

    @Test
    void provider503IsTemporaryAndLogsNoRawPayloadOrStackTrace() {
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(EducationalContentClassifier.class);
        var logs = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        logs.start();
        logger.addAppender(logs);
        try {
            mockAiFailure(new RuntimeException("503 UNAVAILABLE This model is currently experiencing high demand. PRIVATE_PAYLOAD https://provider.invalid/key"));
            var failure = assertThrows(AiProviderUnavailableException.class, this::verifyLesson);
            assertEquals(30, failure.getRetryAfterSeconds());
            assertEquals(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, failure.getStatus());
            assertFalse(failure.getMessage().contains("PRIVATE_PAYLOAD"));
            assertTrue(logs.list.stream().anyMatch(event -> event.getFormattedMessage().contains("temporarily unavailable")));
            assertTrue(logs.list.stream().noneMatch(event -> event.getFormattedMessage().contains("PRIVATE_PAYLOAD")
                    || event.getFormattedMessage().contains("https://") || event.getThrowableProxy() != null));
        } finally {
            logger.detachAppender(logs);
            logs.stop();
        }
    }

    @Test
    void quotaFailureRetainsMappedRetryDelay() {
        mockAiFailure(new RuntimeException("429 RESOURCE_EXHAUSTED Please retry in 10.5s."));
        var failure = assertThrows(AiProviderQuotaException.class, this::verifyLesson);
        assertEquals("AI_PROVIDER_QUOTA_EXCEEDED", failure.getErrorCode());
        assertEquals(11, failure.getRetryAfterSeconds());
    }

    @Test
    void genericProviderRateLimitIsQuotaFailure() {
        mockAiFailure(new RuntimeException("429 Too Many Requests"));
        assertEquals(60, assertThrows(AiProviderQuotaException.class, this::verifyLesson).getRetryAfterSeconds());
    }

    @Test
    void typedProviderFailuresKeepTheirRetryHintsThroughWrappers() {
        mockAiFailure(new RuntimeException(new AiProviderQuotaException("Quota", null, 72)));
        assertEquals(72, assertThrows(AiProviderQuotaException.class, this::verifyLesson).getRetryAfterSeconds());
        setUp();
        mockAiFailure(new RuntimeException(new AiProviderUnavailableException("Unavailable", null, 43)));
        assertEquals(43, assertThrows(AiProviderUnavailableException.class, this::verifyLesson).getRetryAfterSeconds());
    }

    @Test
    void timeoutAndMalformedResponseRemainUnverifiedWithTemporaryErrors() {
        mockAiFailure(new RuntimeException(new java.net.SocketTimeoutException("Timeout")));
        assertThrows(AiProviderUnavailableException.class, this::verifyLesson);
    }

    @Test
    void missingStructuredResponseIsNotAnExplicitUnknownClassification() {
        mockAiResult(null);
        assertThrows(AiProviderUnavailableException.class, this::verifyLesson);
        mockAiResult(new EducationalEvaluationResult(null, "", ""));
        assertThrows(AiProviderUnavailableException.class, this::verifyLesson);
    }

    private static String json(EducationalEvaluationResult result) {
        if (result == null) return "null";
        return new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode()
                .put("eligibility", result.eligibility() == null ? null : result.eligibility().name())
                .put("primaryCategory", result.primaryCategory()).put("reason", result.reason()).toString();
    }

    private void verifyLesson() {
        classifier.validateEducationalContent("Programming tutorial", "Teacher", "27", "Variables store data.", "en");
    }

    @Test
    void strongEducationalGamingTutorialIsNotRejectedOnlyBecauseOfGamingCategory() {

        mockAiResult(
                new EducationalEvaluationResult(
                        ContentEligibility.EDUCATIONAL,
                        "GAME_TUTORIAL",
                        "The primary purpose is teaching a game mechanic."
                )
        );

        assertDoesNotThrow(
                () -> classifier.validateEducationalContent(
                        "Minecraft Redstone Tutorial Step by Step",
                        "Technical Minecraft",
                        "20",
                        """
                        Today I will explain how redstone circuits work.
                        First we will create a basic circuit and then
                        understand repeaters and comparators.
                        """,
                        "English"
                )
        );
    }

    @Test
    void weakKeywordAiDoesNotAutomaticallyApproveVideo() {

        mockAiResult(
                new EducationalEvaluationResult(
                        ContentEligibility.ENTERTAINMENT,
                        "COMEDY",
                        "AI is mentioned, but the primary purpose is entertainment."
                )
        );

        assertThrows(
                NonEducationalContentException.class,
                () -> classifier.validateEducationalContent(
                        "AI Funny Moments",
                        "Comedy Channel",
                        "",
                        """
                        Today we're reacting to funny AI-generated clips
                        and joking about the results.
                        """,
                        "English"
                )
        );
    }

    @Test
    void weakKeywordJavaDoesNotAutomaticallyApproveVideo() {

        mockAiResult(
                new EducationalEvaluationResult(
                        ContentEligibility.ENTERTAINMENT,
                        "GAMING",
                        "Java appears in the title but the content is gaming entertainment."
                )
        );

        assertThrows(
                NonEducationalContentException.class,
                () -> classifier.validateEducationalContent(
                        "Minecraft Java Funny Moments",
                        "Gaming Channel",
                        "",
                        """
                        Welcome back everyone. Today we're playing Minecraft
                        with friends and showing our funniest moments.
                        """,
                        "English"
                )
        );
    }

    @SuppressWarnings({
            "unchecked",
            "rawtypes"
    })
    private void mockAiResult(
            EducationalEvaluationResult result) {

        when(
                chatClient
                        .prompt()
                        .options(any(org.springframework.ai.chat.prompt.ChatOptions.class))
                        .user(any(Consumer.class))
                        .call()
                        .content()
        ).thenReturn(json(result));
    }

    @SuppressWarnings({
            "unchecked",
            "rawtypes"
    })
    private void mockAiFailure(
            RuntimeException exception) {

        when(
                chatClient
                        .prompt()
                        .options(any(org.springframework.ai.chat.prompt.ChatOptions.class))
                        .user(any(Consumer.class))
                        .call()
                        .content()
        ).thenThrow(exception);
    }
}
