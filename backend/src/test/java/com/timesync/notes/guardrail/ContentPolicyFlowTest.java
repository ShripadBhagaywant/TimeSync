package com.timesync.notes.guardrail;

import com.timesync.notes.dto.request.*;
import com.timesync.notes.dto.response.TranscriptSegmentDto;
import com.timesync.notes.entity.*;
import com.timesync.notes.exception.*;
import com.timesync.notes.integration.youtube.*;
import com.timesync.notes.model.ExtractedTranscript;
import com.timesync.notes.service.*;
import com.timesync.notes.service.impl.TranscriptCleaningServiceImpl;
import com.timesync.notes.service.note.TranscriptDraftFormatter;
import com.timesync.notes.strategy.RegexCleaningStrategy;
import com.timesync.notes.util.PastedTranscriptParser;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.*;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.retry.TransientAiException;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ContentPolicyFlowTest {
    private final String id = "abcdefghijk";
    private final VideoExtractionService extraction = mock(VideoExtractionService.class);
    private final ChatModel model = mock(ChatModel.class);
    private final AiNoteJobService jobs = mock(AiNoteJobService.class);
    private final TranscriptCleaningServiceImpl service = new TranscriptCleaningServiceImpl(
        extraction, new RegexCleaningStrategy("\\[Music\\]", "\\s+"),
        new EducationalContentClassifier(ChatClient.builder(model).build()), jobs,
        new PastedTranscriptParser(), new TranscriptDraftFormatter(), new YoutubeSingleFlight(), new YoutubeTranscriptCache());

    @BeforeEach void setup() {
        when(extraction.getVideoTitle(id)).thenReturn("My Thoughts on AI");
        when(extraction.getVideoChannelName(id)).thenReturn("Channel");
        when(extraction.getVideoCategoryId(id)).thenReturn("24");
        when(extraction.getVideoDuration(id)).thenReturn("10:00");
        when(extraction.extractTranscript(id, "Original")).thenReturn(new ExtractedTranscript(
            "Variables hold data. Functions organize instructions.",
            List.of(new TranscriptSegmentDto(0, 5, "Variables hold data.")), "en", false, "English", List.of()));
        result("EDUCATIONAL");
    }
    private void result(String eligibility) {
        when(model.call(any(Prompt.class))).thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage(
            "{\"eligibility\":\"" + eligibility + "\",\"primaryCategory\":\"CONTENT\",\"reason\":\"Dominant purpose assessment\"}")))));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '~', value = {
        "Drishyam 3: The Conclusion - Review (Spoiler Free)~ENTERTAINMENT_MEDIA_REVIEW",
        "Avengers Endgame Movie Review~ENTERTAINMENT_MEDIA_REVIEW",
        "Movie Ending Explained~ENTERTAINMENT_MEDIA_REVIEW",
        "Official Movie Trailer~MOVIE_TRAILER",
        "Funny Reaction to Movie Scenes~ENTERTAINMENT_MEDIA_REVIEW",
        "I’M NOT READY TO GET HURT AGAIN!!😭 IND vs AUS first?? 💀 | WC 2027 Schedule~SPORTS_REACTION_ENTERTAINMENT",
        "Minecraft Funny Moments~GAMING_ENTERTAINMENT",
        "Official Music Video~MUSIC_CONTENT",
        "Celebrity Reaction Compilation~CELEBRITY_ENTERTAINMENT",
        "Daily Vlog~VLOG_CONTENT"
    })
    void rejectsBeforeAnyChapterCaptionOrProviderRequest(String title, ContentReasonCode expected) {
        when(extraction.getVideoTitle(id)).thenReturn(title);
        var failure = assertThrows(NonEducationalContentException.class, () -> service.extractAndProcess(new ExtractVideoRequest(id)));
        assertEquals(expected, failure.getDecision().reasonCode());
        assertEquals(VerificationLevel.METADATA_VERIFIED, failure.getDecision().verificationLevel());
        verify(extraction, never()).discoverChapters(anyString());
        verify(extraction, never()).extractChapters(anyString());
        verify(extraction, never()).extractTranscript(anyString(), anyString());
        verify(model, never()).call(any(Prompt.class));
        verifyNoInteractions(jobs);
        var body = new GlobalExceptionHandler().handleApiException(failure).getBody();
        assertEquals("NON_EDUCATIONAL_CONTENT", body.getProperties().get("code"));
        assertEquals(expected, body.getProperties().get("contentReasonCode"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"React 19 Review", "Java Collections Review", "Research Paper Review: Transformers",
        "Database Design Review", "Operating Systems Course", "System Design Interview Tutorial",
        "How Recommendation Systems Work", "How Cricket DRS Works", "Physics of Swing Bowling",
        "World Cup 2027 Format Explained", "Cricket Statistics Analysis", "Building a Movie Recommendation System",
        "Understanding Netflix Architecture", "My Thoughts on AI", "Understanding Modern Streaming Platforms",
        "Vector Databases Explained", "History of Cricket", "How Recommendation Engines Work"})
    void protectedAndAmbiguousTitlesStillRequireSemanticVerification(String title) {
        when(extraction.getVideoTitle(id)).thenReturn(title);
        var response = service.extractAndProcess(new ExtractVideoRequest(id));
        assertEquals(ContentEligibility.UNKNOWN, new MetadataContentPolicy().evaluate(title, "Channel", "24").eligibility());
        assertEquals(ContentEligibility.EDUCATIONAL, response.contentEligibility());
        assertEquals(VerificationLevel.SEMANTIC_VERIFIED, response.verificationLevel());
        assertEquals(ContentReasonCode.SEMANTIC_EDUCATIONAL, response.contentReasonCode());
        verify(model).call(any(Prompt.class));
        verify(extraction).extractTranscript(id, "Original");
        verifyNoInteractions(jobs);
    }

    @ParameterizedTest @ValueSource(strings = {"10", "17", "20", "24"})
    void categoryAloneCannotHardReject(String category) {
        assertEquals(ContentEligibility.UNKNOWN, new MetadataContentPolicy().evaluate("A discussion", "Channel", category).eligibility());
    }

    @Test void captionAbsenceIsAnUnverifiedWorkspace() {
        when(extraction.extractTranscript(id, "Original")).thenThrow(new UnprocessableVideoException("Absent", "CAPTIONS_UNAVAILABLE"));
        var response = service.extractAndProcess(new ExtractVideoRequest(id));
        assertEquals(NoteSource.METADATA, response.noteSource());
        assertEquals(ContentEligibility.UNKNOWN, response.contentEligibility());
        assertEquals(VerificationLevel.UNVERIFIED, response.verificationLevel());
        assertEquals(ContentReasonCode.TRANSCRIPT_UNAVAILABLE, response.contentReasonCode());
        assertFalse(response.aiRefinementEnabled());
        verify(model, never()).call(any(Prompt.class));
        verifyNoInteractions(jobs);
    }

    @ParameterizedTest @ValueSource(strings = {"EDUCATIONAL", "INFORMATIONAL"})
    void importsReturnUnverifiedSourceWithoutCallingProvider(String eligibility) {
        result(eligibility);
        var response = service.importTranscript(new ImportTranscriptRequest(id, "0:00 Variables hold data.", List.of(), true));
        assertEquals(ContentEligibility.UNKNOWN, response.contentEligibility());
        assertEquals(VerificationLevel.UNVERIFIED, response.verificationLevel());
        verify(model, never()).call(any(Prompt.class));
        verifyNoInteractions(jobs);
    }

    @ParameterizedTest @ValueSource(strings = {"UNKNOWN", "ENTERTAINMENT"})
    void semanticRejectionAppliesWhenCreatingDraftFromImport(String eligibility) {
        result(eligibility);
        var failure = assertThrows(NonEducationalContentException.class,
            () -> parseThenCreateDraft("0:00\nHere is the content."));
        assertEquals("NON_EDUCATIONAL_CONTENT", failure.getErrorCode());
        assertEquals(ContentEligibility.valueOf(eligibility), failure.getDecision().eligibility());
        verifyNoInteractions(jobs);
    }

    @ParameterizedTest @CsvSource({"503,AI_PROVIDER_UNAVAILABLE", "429,AI_PROVIDER_QUOTA_EXCEEDED"})
    void providerFailureOccursAtDraftCreationInsteadOfImport(int status, String code) {
        when(model.call(any(Prompt.class))).thenThrow(new TransientAiException(status + " Provider failure"));
        var failure = assertThrows(ApiException.class, () -> parseThenCreateDraft("0:00\nVariables hold data."));
        assertEquals(code, failure.getErrorCode());
        assertEquals(status, failure.getStatus().value());
        verifyNoInteractions(jobs);
    }

    @Test void malformedVerificationAtDraftCreationIsProviderFailure() {
        when(model.call(any(Prompt.class))).thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage("not valid JSON")))));
        var failure = assertThrows(AiProviderUnavailableException.class, () -> parseThenCreateDraft("0:00\nVariables hold data."));
        assertEquals("AI_PROVIDER_UNAVAILABLE", failure.getErrorCode());
        assertEquals(503, failure.getStatus().value());
        verifyNoInteractions(jobs);
    }

    private void parseThenCreateDraft(String text) {
        var source = service.importTranscript(new ImportTranscriptRequest(id, text, List.of(), true));
        assertEquals(VerificationLevel.UNVERIFIED, source.verificationLevel());
        assertFalse(source.transcriptSegments().isEmpty());
        verify(model, never()).call(any(Prompt.class));
        service.refineTranscript(new RefineTranscriptRequest(id, source.content(), source.transcriptSegments(),
                source.transcriptLanguage(), source.chapters(), true, "English"));
    }

    @Test void malformedStructuredOutputIsProviderFailure() {
        when(model.call(any(Prompt.class))).thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage("429 PRIVATE_PAYLOAD not valid JSON")))));
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        var logs = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        logs.start(); logger.addAppender(logs);
        try {
            var failure = assertThrows(AiProviderUnavailableException.class, () -> service.extractAndProcess(new ExtractVideoRequest(id)));
            assertEquals("AI_PROVIDER_UNAVAILABLE", failure.getErrorCode());
            assertTrue(logs.list.stream().noneMatch(event -> event.getFormattedMessage().contains("PRIVATE_PAYLOAD") || event.getThrowableProxy() != null));
        } finally { logger.detachAppender(logs); logs.stop(); }
        verifyNoInteractions(jobs);
    }
}
