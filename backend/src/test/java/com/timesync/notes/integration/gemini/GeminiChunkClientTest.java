package com.timesync.notes.integration.gemini;

import com.timesync.notes.dto.response.CleanedNoteResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.Prompt;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class GeminiChunkClientTest {
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"English", "Hindi", "Spanish", "French", "German"})
    void passesSelectedLanguageIntoGenerationPrompt(String language) {
        var chat = mock(ChatClient.class);
        var request = mock(ChatClient.ChatClientRequestSpec.class);
        var response = mock(ChatClient.CallResponseSpec.class);
        when(chat.prompt(any(Prompt.class))).thenReturn(request);
        when(request.call()).thenReturn(response);
        when(response.entity(CleanedNoteResponse.class)).thenReturn(new CleanedNoteResponse("notes", List.of()));
        new GeminiChunkClient(chat, "Output Language: {targetLanguage}\n{transcriptChunk}")
                .process("Source evidence", 1, 1, "Lesson", language, false, "configured-model");
        var prompt = ArgumentCaptor.forClass(Prompt.class);
        verify(chat).prompt(prompt.capture());
        assertTrue(prompt.getValue().getContents().contains("Output Language: " + language));
        assertFalse(prompt.getValue().getContents().contains("{targetLanguage}"));
    }

    @Test void primaryHighDemandWithSuccessfulRealClientFallbackEmitsNoError() {
        ChatClient chat = mock(ChatClient.class);
        var request = mock(ChatClient.ChatClientRequestSpec.class);
        var response = mock(ChatClient.CallResponseSpec.class);
        var selectedModel = new java.util.concurrent.atomic.AtomicReference<String>();
        when(chat.prompt(any(Prompt.class))).thenAnswer(call -> {
            selectedModel.set(((Prompt) call.getArgument(0)).getOptions().getModel());
            return request;
        });
        when(request.call()).thenAnswer(call -> {
            if (selectedModel.get().equals("gemini-3.8-flash")) throw new RuntimeException("503 UNAVAILABLE high demand PRIVATE_PAYLOAD");
            return response;
        });
        when(response.entity(CleanedNoteResponse.class)).thenReturn(new CleanedNoteResponse("draft", List.of()));
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger("com.timesync.notes");
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start(); logger.addAppender(appender);
        var executor = java.util.concurrent.Executors.newSingleThreadExecutor();
        try {
            var strategy = new com.timesync.notes.strategy.GeminiAiCleaningStrategy(chat, executor, "{transcriptChunk}", 60,
                    "gemini-3.8-flash", "gemini-3.5-flash-lite");
            assertEquals("draft", strategy.processChunks("source", "English", "Lesson", false).get(0).cleanedNotes());
            verify(request, times(2)).call();
            assertTrue(appender.list.stream().noneMatch(e -> e.getLevel() == ch.qos.logback.classic.Level.ERROR));
            assertTrue(appender.list.stream().anyMatch(e -> e.getFormattedMessage().contains("switching to fallback")));
            assertTrue(appender.list.stream().noneMatch(e -> e.getFormattedMessage().contains("PRIVATE_PAYLOAD")));
        } finally { executor.shutdownNow(); logger.detachAppender(appender); appender.stop(); }
    }

    @Test void highDemandWarnsWithoutStackAndRethrowsOriginal() {
        assertFailureLog(new RuntimeException("503 UNAVAILABLE high demand PRIVATE_PAYLOAD api-key=SECRET https://secret"),
                ch.qos.logback.classic.Level.WARN, "retryAfterSeconds=30", false);
    }

    @Test void quotaWarnsWithRetryMetadataAndRethrowsOriginal() {
        assertFailureLog(new RuntimeException("429 RESOURCE_EXHAUSTED Please retry in 12.5s PRIVATE_PAYLOAD"),
                ch.qos.logback.classic.Level.WARN, "retryAfterSeconds=13", false);
    }

    @Test void unexpectedFailureRetainsSafeStackFramesWithoutProviderMessages() {
        RuntimeException failure = new RuntimeException("PRIVATE_PAYLOAD", new IllegalArgumentException("api-key=SECRET"));
        failure.addSuppressed(new IllegalStateException("https://secret PRIVATE_CHUNK"));
        assertFailureLog(failure, ch.qos.logback.classic.Level.ERROR, "errorType=RuntimeException", true);
    }

    @Test void retiredModelUsesWarningBecauseFallbackIsExpected() {
        assertFailureLog(new RuntimeException("404 model not found PRIVATE_PAYLOAD"),
                ch.qos.logback.classic.Level.WARN, "fallbackEligible=true", false);
    }

    private void assertFailureLog(RuntimeException failure, ch.qos.logback.classic.Level level, String detail, boolean stack) {
        ChatClient chat = mock(ChatClient.class);
        var request = mock(ChatClient.ChatClientRequestSpec.class);
        when(chat.prompt(any(Prompt.class))).thenReturn(request);
        when(request.call()).thenThrow(failure);
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(GeminiChunkClient.class);
        var previous = logger.getLevel();
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start(); logger.addAppender(appender); logger.setLevel(ch.qos.logback.classic.Level.DEBUG);
        try {
            assertSame(failure, assertThrows(RuntimeException.class, () -> new GeminiChunkClient(chat, "PRIVATE_PROMPT {transcriptChunk}")
                    .process("PRIVATE_CHUNK", 1, 5, "Lesson", "English", false, "gemini-3.8-flash")));
            var event = appender.list.get(appender.list.size() - 1);
            assertEquals(level, event.getLevel());
            assertTrue(event.getFormattedMessage().contains(detail));
            if (stack) {
                assertNotNull(event.getThrowableProxy());
                assertEquals(failure.getStackTrace()[0], event.getThrowableProxy().getStackTraceElementProxyArray()[0].getStackTraceElement());
                assertNotNull(event.getThrowableProxy().getCause());
            } else {
                assertNull(event.getThrowableProxy());
                assertTrue(appender.list.stream().noneMatch(e -> e.getLevel() == ch.qos.logback.classic.Level.ERROR));
            }
            for (var logged : appender.list) {
                String output = logged.getFormattedMessage() + (logged.getThrowableProxy() == null ? "" :
                        ch.qos.logback.classic.spi.ThrowableProxyUtil.asString(logged.getThrowableProxy()));
                for (String secret : List.of("PRIVATE_PAYLOAD", "PRIVATE_CHUNK", "PRIVATE_PROMPT", "SECRET", "https://secret")) {
                    assertFalse(output.contains(secret), "Log must not expose " + secret);
                }
            }
        } finally { logger.detachAppender(appender); logger.setLevel(previous); appender.stop(); }
    }

    @Test void preservesResolvedPromptModelAndStructuredResponse() {
        ChatClient chat = mock(ChatClient.class);
        var request = mock(ChatClient.ChatClientRequestSpec.class);
        var response = mock(ChatClient.CallResponseSpec.class);
        when(chat.prompt(any(Prompt.class))).thenReturn(request);
        when(request.call()).thenReturn(response);
        var expected = new CleanedNoteResponse("Notes", List.of());
        when(response.entity(CleanedNoteResponse.class)).thenReturn(expected);
        var client = new GeminiChunkClient(chat,
                "{videoTitle}|{targetLanguage}|{chunkIndex}/{totalChunks}|{chapterGenerationInstruction}|{transcriptChunk}");
        assertSame(expected, client.process("x { y }", 1, 2, " Lesson ", "Hindi", true, "test-model"));
        var prompt = ArgumentCaptor.forClass(Prompt.class);
        verify(chat).prompt(prompt.capture());
        assertEquals("test-model", prompt.getValue().getOptions().getModel());
        assertEquals("Lesson|Hindi|1/2|Creator or user chapters already exist. Do not generate chapters; "
                + "return an empty chapters array and focus only on structured notes.|x \\{ y \\}", prompt.getValue().getContents());
    }
    @Test void emptyStructuredResponseRemainsAnError() {
        ChatClient chat = mock(ChatClient.class);
        var request = mock(ChatClient.ChatClientRequestSpec.class);
        var response = mock(ChatClient.CallResponseSpec.class);
        when(chat.prompt(any(Prompt.class))).thenReturn(request);
        when(request.call()).thenReturn(response);
        assertThrows(IllegalStateException.class,
                () -> new GeminiChunkClient(chat, "{transcriptChunk}").process("source", 1, 1, "Title", "English", false, "model"));
    }
}
