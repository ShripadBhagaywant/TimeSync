package com.timesync.notes.service;

import com.timesync.notes.config.SpringAiConfig;
import com.timesync.notes.dto.request.RefineTranscriptRequest;
import com.timesync.notes.entity.AiProcessingStatus;
import com.timesync.notes.entity.ContentEligibility;
import com.timesync.notes.exception.AiProviderQuotaException;
import com.timesync.notes.exception.AiProviderUnavailableException;
import com.timesync.notes.exception.NonEducationalContentException;
import com.timesync.notes.guardrail.EducationalContentClassifier;
import com.timesync.notes.integration.youtube.YoutubeSingleFlight;
import com.timesync.notes.integration.youtube.YoutubeTranscriptCache;
import com.timesync.notes.service.impl.TranscriptCleaningServiceImpl;
import com.timesync.notes.service.note.TranscriptDraftFormatter;
import com.timesync.notes.strategy.RegexCleaningStrategy;
import com.timesync.notes.util.PastedTranscriptParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.retry.TransientAiException;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RefinementClassifierFlowTest {
    private final ChatModel model = mock(ChatModel.class);
    private final EducationalContentClassifier classifier = spy(
            new EducationalContentClassifier(ChatClient.builder(model).build()));
    private final VideoExtractionService extraction = mock(VideoExtractionService.class);
    private final RegexCleaningStrategy regex = mock(RegexCleaningStrategy.class);
    private final AiNoteJobService jobs = mock(AiNoteJobService.class);
    private final TranscriptCleaningServiceImpl service = new TranscriptCleaningServiceImpl(
            extraction, regex, classifier, jobs, new PastedTranscriptParser(), new TranscriptDraftFormatter(),
            new YoutubeSingleFlight(), new YoutubeTranscriptCache());
    private final RefineTranscriptRequest request = new RefineTranscriptRequest(
            "abcdefghijk", "Evidence", List.of(), "en", List.of(), true, "English");

    @BeforeEach void metadata() {
        when(extraction.getVideoTitle(anyString())).thenReturn("Programming tutorial");
        when(extraction.getVideoChannelName(anyString())).thenReturn("Teacher");
        when(extraction.getVideoCategoryId(anyString())).thenReturn("27");
        when(extraction.getVideoDuration(anyString())).thenReturn("10:00");
        when(regex.clean(any(), any(), any())).thenReturn("Variables store values.");
    }

    @ParameterizedTest
    @CsvSource({"Programming tutorial,UNKNOWN,EDUCATIONAL",
            "Programming tutorial,UNKNOWN,INFORMATIONAL",
            "A discussion,UNKNOWN,EDUCATIONAL", "A discussion,UNKNOWN,INFORMATIONAL"})
    void metadataIsEvaluatedOnceAndNeverSkipsSemanticCall(String title,
            ContentEligibility metadata, ContentEligibility semantic) {
        when(extraction.getVideoTitle(anyString())).thenReturn(title);
        when(model.call(any(Prompt.class))).thenReturn(new ChatResponse(List.of(new Generation(
                new AssistantMessage("{\"eligibility\":\"" + semantic
                        + "\",\"primaryCategory\":\"STUDY\",\"reason\":\"Teaching concepts\"}")))));
        when(jobs.submit(any(), any(), any())).thenReturn(
                new AiNoteJobService.Submission(AiProcessingStatus.QUEUED, "job", "Queued", null));

        var response = service.refineTranscript(request);
        assertEquals(AiProcessingStatus.QUEUED, response.aiStatus());
        assertEquals(semantic, response.contentEligibility());
        assertEquals(com.timesync.notes.guardrail.VerificationLevel.SEMANTIC_VERIFIED, response.verificationLevel());
        verify(classifier).validateVideoMetadata(title, "Teacher", "27");
        verify(classifier).validateEducationalContent(title, "Teacher", "27", "Variables store values.", "en", metadata);
        verify(model).call(any(Prompt.class));
        verify(jobs).submit(any(), eq("Variables store values."), eq("English"));
    }

    @Test void entertainmentStillRejectsBeforeSanitizationOrProviderCall() {
        when(extraction.getVideoTitle(anyString())).thenReturn("Official music video");
        assertThrows(NonEducationalContentException.class, () -> service.refineTranscript(request));
        verify(classifier).validateVideoMetadata("Official music video", "Teacher", "27");
        verify(model, never()).call(any(Prompt.class));
        verifyNoInteractions(regex, jobs);
    }

    @Test void importParsesWithoutAnyAiCallAndDraftClickVerifiesBeforeQueueing() {
        var source = service.importTranscript(new com.timesync.notes.dto.request.ImportTranscriptRequest(
                "abcdefghijk", "0:00\nDocker containers isolate applications.\n0:10\nImages package dependencies.", List.of(), true));
        assertEquals(2, source.transcriptSegments().size());
        assertEquals(com.timesync.notes.guardrail.VerificationLevel.UNVERIFIED, source.verificationLevel());
        assertEquals(AiProcessingStatus.NOT_REQUESTED, source.aiStatus());
        verify(model, never()).call(any(Prompt.class));
        verifyNoInteractions(jobs, regex);

        when(model.call(any(Prompt.class))).thenReturn(new ChatResponse(List.of(new Generation(
                new AssistantMessage("{\"eligibility\":\"EDUCATIONAL\",\"primaryCategory\":\"PROGRAMMING\",\"reason\":\"Teaches Docker\"}")))));
        when(jobs.submit(any(), any(), any())).thenReturn(
                new AiNoteJobService.Submission(AiProcessingStatus.QUEUED, "job", "Queued", null));
        var response = service.refineTranscript(new RefineTranscriptRequest(source.videoId(), source.content(),
                source.transcriptSegments(), source.transcriptLanguage(), source.chapters(), true, "English"));
        var order = inOrder(model, jobs);
        order.verify(model).call(any(Prompt.class));
        order.verify(jobs).submit(any(), any(), eq("English"));
        assertEquals(AiProcessingStatus.QUEUED, response.aiStatus());
        assertEquals(com.timesync.notes.guardrail.VerificationLevel.SEMANTIC_VERIFIED, response.verificationLevel());
    }

    @Test void unavailableIsOneAttemptAndUserRetryMakesAFreshDecision() {
        when(model.call(any(Prompt.class))).thenThrow(new TransientAiException("503 UNAVAILABLE high demand"));
        for (int attempt = 1; attempt <= 2; attempt++) {
            var error = assertThrows(AiProviderUnavailableException.class, () -> service.refineTranscript(request));
            assertEquals("AI_PROVIDER_UNAVAILABLE", error.getErrorCode());
            assertEquals(30, error.getRetryAfterSeconds());
            verify(model, times(attempt)).call(any(Prompt.class));
            verify(classifier, times(attempt)).validateVideoMetadata("Programming tutorial", "Teacher", "27");
        }
        verifyNoInteractions(jobs);
    }

    @Test void quotaIsOneAttemptAndKeepsRetryDelay() {
        when(model.call(any(Prompt.class))).thenThrow(new TransientAiException("429 Please retry in 47s"));
        var error = assertThrows(AiProviderQuotaException.class, () -> service.refineTranscript(request));
        assertEquals("AI_PROVIDER_QUOTA_EXCEEDED", error.getErrorCode());
        assertEquals(47, error.getRetryAfterSeconds());
        verify(model).call(any(Prompt.class));
        verifyNoInteractions(jobs);
    }

    @Test void configuredProviderRetryTemplateAttemptsOnlyOnce() {
        var attempts = new AtomicInteger();
        assertThrows(TransientAiException.class, () -> new SpringAiConfig().geminiRetryTemplate().execute(context -> {
            attempts.incrementAndGet();
            throw new TransientAiException("503 UNAVAILABLE");
        }));
        assertEquals(1, attempts.get());
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"English", "Hindi", "Spanish", "French", "German"})
    void selectedLanguageIsPreservedInJobSourceAndQueuedResponse(String language) {
        when(model.call(any(Prompt.class))).thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage(
                "{\"eligibility\":\"EDUCATIONAL\",\"primaryCategory\":\"PROGRAMMING\",\"reason\":\"Teaching\"}")))));
        when(jobs.submit(any(), any(), any())).thenReturn(new AiNoteJobService.Submission(AiProcessingStatus.QUEUED, "job", "Queued", null));
        var response = service.refineTranscript(new RefineTranscriptRequest(request.videoId(), request.transcript(),
                request.transcriptSegments(), request.transcriptLanguage(), request.chapters(), true, language));
        var source = org.mockito.ArgumentCaptor.forClass(com.timesync.notes.dto.response.TranscriptResponse.class);
        verify(jobs).submit(source.capture(), anyString(), eq(language));
        assertEquals(language, source.getValue().targetLanguage());
        assertEquals(language, response.targetLanguage());
        assertEquals(com.timesync.notes.guardrail.VerificationLevel.SEMANTIC_VERIFIED, source.getValue().verificationLevel());
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.NullAndEmptySource
    @org.junit.jupiter.params.provider.ValueSource(strings = {"   "})
    void absentLanguageDefaultsToEnglish(String language) {
        assertEquals("English", new RefineTranscriptRequest(request.videoId(), request.transcript(),
                List.of(), "en", List.of(), true, language).targetLanguage());
    }
}
