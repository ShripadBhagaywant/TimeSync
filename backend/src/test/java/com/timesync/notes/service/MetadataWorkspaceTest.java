package com.timesync.notes.service;

import com.timesync.notes.dto.request.ExtractVideoRequest;
import com.timesync.notes.dto.request.ImportTranscriptRequest;
import com.timesync.notes.dto.request.RefineTranscriptRequest;
import com.timesync.notes.dto.response.ChapterDto;
import com.timesync.notes.entity.AiProcessingStatus;
import com.timesync.notes.entity.NoteSource;
import com.timesync.notes.entity.TranscriptAvailability;
import com.timesync.notes.exception.*;
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
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MetadataWorkspaceTest {
    private static final String VIDEO = "abcdefghijk";
    private final VideoExtractionService extraction = mock(VideoExtractionService.class);
    private final EducationalContentClassifier classifier = com.timesync.notes.guardrail.ClassifierTestDouble.approved();
    private final RegexCleaningStrategy regex = mock(RegexCleaningStrategy.class);
    private final AiNoteJobService jobs = mock(AiNoteJobService.class);
    private final TranscriptCleaningServiceImpl service = new TranscriptCleaningServiceImpl(
            extraction, regex, classifier, jobs, new PastedTranscriptParser(), new TranscriptDraftFormatter(),
            new YoutubeSingleFlight(), new YoutubeTranscriptCache());

    @BeforeEach void metadata() {
        when(extraction.getVideoTitle(VIDEO)).thenReturn("Programming lesson");
        when(extraction.getVideoChannelName(VIDEO)).thenReturn("Teacher");
        when(extraction.getVideoCategoryId(VIDEO)).thenReturn("27");
        when(extraction.getVideoDuration(VIDEO)).thenReturn("10:00");
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void captionCleaningBoundaryDiagnosesRemovedEvidence(boolean removeAll) {
        String source = "PRIVATE_TRANSCRIPT variables and functions explain programming.";
        var parsed = com.timesync.notes.util.SubtitlePayloadParser.parse(
            "WEBVTT\n\n00:00:00.000 --> 00:00:03.000\n" + source + "\n", "en", false).transcript();
        when(extraction.extractTranscript(VIDEO, "Original")).thenReturn(parsed);
        when(regex.clean(any(), any(), any())).thenReturn(removeAll ? "" : source);
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(TranscriptCleaningServiceImpl.class);
        var old = logger.getLevel();
        var logs = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        logs.start(); logger.addAppender(logs); logger.setLevel(ch.qos.logback.classic.Level.DEBUG);
        try {
            service.extractAndProcess(new ExtractVideoRequest(VIDEO));
            assertTrue(logs.list.stream().anyMatch(e -> e.getFormattedMessage().contains("parsedSegments=1")
                && e.getFormattedMessage().contains(removeAll ? "reason=POST_PARSE_EMPTY" : "reason=OK")));
            assertTrue(logs.list.stream().noneMatch(e -> e.getFormattedMessage().contains("PRIVATE_TRANSCRIPT")));
            verify(classifier).validateEducationalContent(any(), any(), any(), eq(removeAll ? "" : source), any(), any());
        } finally { logger.detachAppender(logs); logger.setLevel(old); logs.stop(); }
    }

    private void noCaptions() {
        when(extraction.extractTranscript(VIDEO, "Original"))
                .thenThrow(new UnprocessableVideoException("No captions", "CAPTIONS_UNAVAILABLE"));
    }

    @Test void nativeChaptersAndMetadataSurviveCaptionAbsence() {
        noCaptions();
        var chapters = List.of(new ChapterDto("Introduction", 0, "00:00"));
        when(extraction.extractChapters(VIDEO)).thenReturn(chapters);
        var response = service.extractAndProcess(new ExtractVideoRequest(VIDEO));
        assertEquals(VIDEO, response.videoId());
        assertEquals("Programming lesson", response.title());
        assertEquals("Teacher", response.channelName());
        assertEquals("10:00", response.duration());
        assertEquals("https://img.youtube.com/vi/" + VIDEO + "/hqdefault.jpg", response.thumbnailUrl());
        assertEquals(chapters, response.chapters());
        assertFalse(response.isEditableChapters());
        assertEquals(NoteSource.METADATA, response.noteSource());
        assertEquals(TranscriptAvailability.UNAVAILABLE, response.transcriptAvailability());
        assertEquals(AiProcessingStatus.NOT_APPLICABLE, response.aiStatus());
        verifyNoInteractions(regex, jobs);
        verify(classifier, never()).validateEducationalContent(any(), any(), any(), any(), any(), any());
    }

    static Stream<RuntimeException> temporaryFailures() {
        return Stream.of(new UpstreamRateLimitException("Cooldown", 47),
                new UpstreamServiceUnavailableException("Unavailable", null),
                new ResourceAccessException("Connection unavailable"),
                new HttpServerErrorException(HttpStatus.SERVICE_UNAVAILABLE),
                new YoutubeBusyException("Busy"));
    }

    @ParameterizedTest @MethodSource("temporaryFailures")
    void temporaryChapterFailureDoesNotPreventMetadataWorkspace(RuntimeException failure) {
        noCaptions();
        when(extraction.extractChapters(VIDEO)).thenThrow(failure);
        var response = service.extractAndProcess(new ExtractVideoRequest(VIDEO));
        assertEquals(NoteSource.METADATA, response.noteSource());
        assertTrue(response.chapters().isEmpty());
        assertTrue(response.isEditableChapters());
        verify(extraction).extractTranscript(VIDEO, "Original");
    }

    @ParameterizedTest @MethodSource("temporaryFailures")
    void temporaryCaptionFailureNeverBecomesMetadataWorkspace(RuntimeException failure) {
        when(extraction.extractTranscript(VIDEO, "Original")).thenThrow(failure);
        assertSame(failure, assertThrows(failure.getClass(),
                () -> service.extractAndProcess(new ExtractVideoRequest(VIDEO))));
        verifyNoInteractions(regex, jobs);
        verify(classifier, never()).validateEducationalContent(any(), any(), any(), any(), any(), any());
    }

    @Test void unrelatedUnprocessableErrorsAreNotCaptionAbsence() {
        var failure = new UnprocessableVideoException("Unsupported", "OTHER_ERROR");
        when(extraction.extractTranscript(VIDEO, "Original")).thenThrow(failure);
        assertSame(failure, assertThrows(UnprocessableVideoException.class,
                () -> service.extractAndProcess(new ExtractVideoRequest(VIDEO))));
    }

    @Test void requiredMetadataFailureStillAbortsBeforeChapters() {
        var failure = new UpstreamRateLimitException("Data API cooldown", 47);
        when(extraction.getVideoTitle(VIDEO)).thenThrow(failure);
        assertSame(failure, assertThrows(UpstreamRateLimitException.class,
                () -> service.extractAndProcess(new ExtractVideoRequest(VIDEO))));
        verify(extraction, never()).extractChapters(anyString());
        verify(extraction, never()).extractTranscript(anyString(), anyString());
    }

    @Test void importedTranscriptQueuesOnlyAfterSanitizationAndSemanticVerification() {
        var source = service.importTranscript(new ImportTranscriptRequest(VIDEO,
                "0:00\nVariables store values.\n0:10\nFunctions group instructions.", List.of(), true));
        assertEquals(NoteSource.USER_PROVIDED, source.noteSource());
        assertEquals(TranscriptAvailability.USER_PROVIDED, source.transcriptAvailability());
        assertFalse(source.transcriptSegments().isEmpty());
        verifyNoInteractions(jobs);
        verify(classifier, never()).validateEducationalContent(any(), any(), any(), any(), any(), any());
        verifyNoInteractions(regex);
        assertEquals(com.timesync.notes.guardrail.VerificationLevel.UNVERIFIED, source.verificationLevel());
        clearInvocations(regex, classifier);
        when(regex.clean(any(), any(), any())).thenReturn("Sanitized educational evidence");
        when(jobs.submit(any(), any(), any())).thenReturn(
                new AiNoteJobService.Submission(AiProcessingStatus.QUEUED, "job", "Queued", null));
        var result = service.refineTranscript(new RefineTranscriptRequest(VIDEO, source.content(),
                source.transcriptSegments(), source.transcriptLanguage(), source.chapters(), true, "English"));
        var ordered = inOrder(regex, classifier, jobs);
        ordered.verify(regex).clean(source.content(), source.transcriptLanguage(), source.title());
        ordered.verify(classifier).validateEducationalContent("Programming lesson", "Teacher", "27",
                "Sanitized educational evidence", source.transcriptLanguage(), com.timesync.notes.entity.ContentEligibility.UNKNOWN);
        ordered.verify(jobs).submit(any(), eq("Sanitized educational evidence"), eq("English"));
        assertEquals(AiProcessingStatus.QUEUED, result.aiStatus());
    }

    @Test void pastedYoutubeCopiesAreNormalizedBeforeImportParsing() {
        for (String input : List.of("0:07\n7 seconds\nपहला टेक्स्ट\n0:15\n15 seconds\nदूसरा टेक्स्ट",
                "0:077 secondsपहला टेक्स्ट\n0:1515 secondsदूसरा टेक्स्ट")) {
            var source = service.importTranscript(new ImportTranscriptRequest(VIDEO, input, List.of(), true));
            assertEquals(List.of(7.0, 15.0), source.transcriptSegments().stream()
                    .map(segment -> segment.startSeconds()).toList());
            assertEquals(List.of("पहला टेक्स्ट", "दूसरा टेक्स्ट"), source.transcriptSegments().stream()
                    .map(segment -> segment.text()).toList());
            assertEquals(NoteSource.USER_PROVIDED, source.noteSource());
            assertEquals(TranscriptAvailability.USER_PROVIDED, source.transcriptAvailability());
        }
        verifyNoInteractions(jobs);
        verify(classifier, never()).validateEducationalContent(any(), any(), any(), any(), any(), any());
    }

    @Test void semanticRejectionOfImportedTranscriptPreventsAiSubmission() {
        var source = service.importTranscript(new ImportTranscriptRequest(VIDEO, "Imported words", List.of(), true));
        when(regex.clean(any(), any(), any())).thenReturn("Unverifiable evidence");
        doThrow(new NonEducationalContentException("Unverified content")).when(classifier)
                .validateEducationalContent(any(), any(), any(), any(), any(), any());
        assertThrows(NonEducationalContentException.class, () -> service.refineTranscript(
                new RefineTranscriptRequest(VIDEO, source.content(), source.transcriptSegments(),
                        source.transcriptLanguage(), List.of(), true, "English")));
        verifyNoInteractions(jobs);
    }
    static Stream<RuntimeException> classifierProviderFailures() {
        return Stream.of(new AiProviderUnavailableException("Verification unavailable", null, 30),
                new AiProviderQuotaException("Verification rate-limited", null, 47));
    }

    @ParameterizedTest @MethodSource("classifierProviderFailures")
    void providerFailureDuringImportedTranscriptVerificationNeverQueuesAi(RuntimeException failure) {
        var source = service.importTranscript(new ImportTranscriptRequest(VIDEO, "Imported evidence", List.of(), true));
        clearInvocations(regex, classifier);
        when(regex.clean(any(), any(), any())).thenReturn("Sanitized evidence");
        doThrow(failure).when(classifier).validateEducationalContent(any(), any(), any(), any(), any(), any());
        assertSame(failure, assertThrows(failure.getClass(), () -> service.refineTranscript(
                new RefineTranscriptRequest(VIDEO, source.content(), source.transcriptSegments(),
                        source.transcriptLanguage(), List.of(), true, "English"))));
        var order = inOrder(regex, classifier);
        order.verify(regex).clean(source.content(), source.transcriptLanguage(), source.title());
        order.verify(classifier).validateEducationalContent("Programming lesson", "Teacher", "27", "Sanitized evidence", source.transcriptLanguage(), com.timesync.notes.entity.ContentEligibility.UNKNOWN);
        verifyNoInteractions(jobs);
        assertEquals(NoteSource.USER_PROVIDED, source.noteSource());
        assertEquals("Imported evidence", source.content());
    }

}
