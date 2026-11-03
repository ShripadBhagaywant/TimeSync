package com.timesync.notes.service;
import com.timesync.notes.model.ExtractedTranscript;

import com.timesync.notes.dto.request.ExtractVideoRequest;
import com.timesync.notes.dto.request.RefineTranscriptRequest;
import com.timesync.notes.dto.response.ChapterDto;
import com.timesync.notes.dto.response.TranscriptSegmentDto;
import com.timesync.notes.dto.response.TranscriptResponse;
import com.timesync.notes.entity.AiProcessingStatus;
import com.timesync.notes.exception.NonEducationalContentException;
import com.timesync.notes.exception.UnprocessableVideoException;
import com.timesync.notes.exception.UpstreamRateLimitException;
import com.timesync.notes.guardrail.EducationalContentClassifier;
import com.timesync.notes.service.impl.TranscriptCleaningServiceImpl;
import com.timesync.notes.strategy.RegexCleaningStrategy;
import com.timesync.notes.util.PastedTranscriptParser;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TranscriptCleaningServiceTest {

    @Test
    void chapterRateLimitStillAttemptsAndVerifiesTranscript() {
        String videoId = "abcdefghijk";
        VideoExtractionService extraction = preparedExtraction(videoId);
        var classifier = com.timesync.notes.guardrail.ClassifierTestDouble.approved();
        var regex = mock(RegexCleaningStrategy.class);
        when(extraction.extractChapters(videoId)).thenThrow(new UpstreamRateLimitException("Cooldown", 47));
        when(extraction.extractTranscript(videoId, "Original")).thenReturn(new ExtractedTranscript(
                "Lesson evidence", List.of(new TranscriptSegmentDto(0, 5, "Lesson evidence")), "en", false));
        when(regex.clean(any(), any(), any())).thenReturn("Clean evidence");
        var response = service(extraction, regex, classifier, mock(AiNoteJobService.class))
                .extractAndProcess(new ExtractVideoRequest(videoId));
        assertTrue(response.chapters().isEmpty());
        assertTrue(response.isEditableChapters());
        verify(extraction).extractTranscript(videoId, "Original");
        verify(classifier).validateEducationalContent(any(), any(), any(), eq("Clean evidence"), eq("en"), any());
    }

    @Test
    void rejectsNonEducationalMetadataBeforeCaptionDiscovery() {

        VideoExtractionService extraction =
                mock(VideoExtractionService.class);

        EducationalContentClassifier classifier =
                com.timesync.notes.guardrail.ClassifierTestDouble.approved();

        when(
                extraction.getVideoTitle(
                        "JqFzhcWo3EU"
                )
        ).thenReturn("Music video");

        when(
                extraction.getVideoChannelName(
                        "JqFzhcWo3EU"
                )
        ).thenReturn("Music channel");

        when(
                extraction.getVideoDuration(
                        "JqFzhcWo3EU"
                )
        ).thenReturn("03:30");

        when(
                extraction.getVideoCategoryId(
                        "JqFzhcWo3EU"
                )
        ).thenReturn("10");

        doThrow(
                new NonEducationalContentException(
                        "Entertainment content"
                )
        ).when(classifier)
                .validateVideoMetadata(
                        "Music video",
                        "Music channel",
                        "10"
                );

        TranscriptCleaningServiceImpl service =
                service(
                        extraction,
                        mock(RegexCleaningStrategy.class),
                        classifier,
                        mock(AiNoteJobService.class)
                );

        assertThrows(
                NonEducationalContentException.class,
                () -> service.extractAndProcess(
                        new ExtractVideoRequest(
                                "https://www.youtube.com/watch?v=JqFzhcWo3EU",
                                "English",
                                true
                        )
                )
        );

        verify(
                extraction,
                never()
        ).extractTranscript(
                anyString(),
                anyString()
        );
    }

    @Test
    void permanentCaptionAbsenceOpensMetadataWorkspace() {
        String videoId = "4OUR5jALis4";
        var extraction = preparedExtraction(videoId);
        var classifier = com.timesync.notes.guardrail.ClassifierTestDouble.approved();
        var jobs = mock(AiNoteJobService.class);
        when(extraction.extractTranscript(videoId, "Original"))
                .thenThrow(new UnprocessableVideoException("No captions", "CAPTIONS_UNAVAILABLE"));
        var response = service(extraction, mock(RegexCleaningStrategy.class), classifier, jobs)
                .extractAndProcess(new ExtractVideoRequest(videoId));
        assertEquals(com.timesync.notes.entity.NoteSource.METADATA, response.noteSource());
        assertEquals(com.timesync.notes.entity.TranscriptAvailability.UNAVAILABLE, response.transcriptAvailability());
        assertTrue(response.content().isBlank());
        assertTrue(response.cleanedTranscript().isBlank());
        assertTrue(response.transcriptSegments().isEmpty());
        assertFalse(response.aiRefinementEnabled());
        assertEquals(AiProcessingStatus.NOT_APPLICABLE, response.aiStatus());
        assertNull(response.aiJobId());
        assertNull(response.retryAfterSeconds());
        assertTrue(response.isEditableChapters());
        verify(classifier, never()).validateEducationalContent(any(), any(), any(), any(), any(), any());
        verifyNoInteractions(jobs);
    }

    @Test
    void propagatesRateLimitWhenTranscriptVerificationIsTemporarilyUnavailable() {

        String videoId = "yE6tIle64tU";

        VideoExtractionService extraction =
                preparedExtraction(videoId);

        when(
                extraction.extractChapters(videoId)
        ).thenReturn(List.of());

        when(
                extraction.extractTranscript(
                        videoId,
                        "Original"
                )
        ).thenThrow(
                new UpstreamRateLimitException(
                        "YouTube limited anonymous captions"
                )
        );

        TranscriptCleaningServiceImpl service =
                service(
                        extraction,
                        mock(RegexCleaningStrategy.class),
                        com.timesync.notes.guardrail.ClassifierTestDouble.approved(),
                        mock(AiNoteJobService.class)
                );

        UpstreamRateLimitException exception =
                assertThrows(
                        UpstreamRateLimitException.class,
                        () -> service.extractAndProcess(
                                new ExtractVideoRequest(
                                        "https://www.youtube.com/watch?v=" + videoId,
                                        "English",
                                        false
                                )
                        )
                );

        assertEquals(
                "YouTube limited anonymous captions",
                exception.getMessage()
        );
    }

    @Test
    void aiOffPreservesOriginalTranscriptLanguageAndDoesNotQueueAi() {

        String videoId = "abcdefghijk";

        VideoExtractionService extraction =
                preparedExtraction(videoId);

        RegexCleaningStrategy regex =
                mock(RegexCleaningStrategy.class);

        AiNoteJobService jobs =
                mock(AiNoteJobService.class);

        EducationalContentClassifier classifier =
                com.timesync.notes.guardrail.ClassifierTestDouble.approved();

        when(
                extraction.extractChapters(videoId)
        ).thenReturn(List.of());

        when(
                extraction.extractTranscript(
                        videoId,
                        "Original"
                )
        ).thenReturn(
                new ExtractedTranscript(
                        "मूल पाठ",
                        List.of(
                                new TranscriptSegmentDto(
                                        12,
                                        4,
                                        "मूल पाठ"
                                )
                        ),
                        "hi",
                        false
                )
        );

        TranscriptResponse response =
                service(
                        extraction,
                        regex,
                        classifier,
                        jobs
                ).extractAndProcess(
                        new ExtractVideoRequest(
                                "https://www.youtube.com/watch?v=" + videoId,
                                "English",
                                false
                        )
                );

        assertEquals(
                "hi",
                response.transcriptLanguage()
        );

        assertTrue(
                response.cleanedTranscript()
                        .contains("वीडियो जानकारी")
        );

        assertTrue(
                response.cleanedTranscript()
                        .contains("[00:12]")
        );

        assertTrue(
                response.cleanedTranscript()
                        .contains("मूल पाठ")
        );

        assertEquals(
                AiProcessingStatus.NOT_REQUESTED,
                response.aiStatus()
        );

        assertTrue(
                response.isEditableChapters()
        );

        verify(
                jobs,
                never()
        ).submit(
                any(),
                anyString(),
                anyString()
        );
    }

    @Test
    void workspaceAiQueuesTargetLanguageDraftWhilePreservingTranscriptSegmentsAndNativeChapters() {

        String videoId = "abcdefghijk";

        ChapterDto nativeChapter =
                new ChapterDto(
                        "Native",
                        0,
                        "00:00"
                );

        VideoExtractionService extraction =
                preparedExtraction(videoId);

        RegexCleaningStrategy regex =
                mock(RegexCleaningStrategy.class);

        AiNoteJobService jobs =
                mock(AiNoteJobService.class);

        EducationalContentClassifier classifier =
                com.timesync.notes.guardrail.ClassifierTestDouble.approved();

        when(
                extraction.getVideoCategoryId(videoId)
        ).thenReturn("27");

        when(
                regex.clean(
                        "Original words",
                        "en",
                        "Lesson"
                )
        ).thenReturn("Clean words");

        when(
                jobs.submit(
                        any(TranscriptResponse.class),
                        eq("Clean words"),
                        eq("Spanish")
                )
        ).thenReturn(
                new AiNoteJobService.Submission(
                        AiProcessingStatus.QUEUED,
                        "job-1",
                        "Queued",
                        null
                )
        );

        TranscriptResponse response =
                service(
                        extraction,
                        regex,
                        classifier,
                        jobs
                ).refineTranscript(
                        new RefineTranscriptRequest(
                                videoId,
                                "Original words",
                                List.of(
                                        new TranscriptSegmentDto(
                                                12,
                                                5,
                                                "Original words"
                                        )
                                ),
                                "en",
                                List.of(nativeChapter),
                                false,
                                "Spanish"
                        )
                );

        assertEquals(
                AiProcessingStatus.QUEUED,
                response.aiStatus()
        );

        assertEquals(
                "job-1",
                response.aiJobId()
        );

        assertEquals(
                "en",
                response.transcriptLanguage()
        );

        assertEquals(
                "Spanish",
                response.targetLanguage()
        );

        assertEquals(
                List.of(nativeChapter),
                response.chapters()
        );

        assertFalse(
                response.isEditableChapters()
        );

        assertEquals(
                12,
                response.transcriptSegments()
                        .get(0)
                        .startSeconds()
        );

        assertNull(
                response.retryAfterSeconds()
        );

        verify(classifier).validateEducationalContent(
                eq("Lesson"),
                eq("Learning Channel"),
                eq("27"),
                eq("Clean words"),
                eq("en"), any());

        verify(
                extraction,
                never()
        ).extractChapters(videoId);
    }

    @Test
    void workspaceAiPropagatesRetryAfterWhenProviderIsCoolingDown() {

        String videoId = "abcdefghijk";

        VideoExtractionService extraction =
                preparedExtraction(videoId);

        RegexCleaningStrategy regex =
                mock(RegexCleaningStrategy.class);

        AiNoteJobService jobs =
                mock(AiNoteJobService.class);

        EducationalContentClassifier classifier =
                com.timesync.notes.guardrail.ClassifierTestDouble.approved();

        when(
                extraction.getVideoCategoryId(videoId)
        ).thenReturn("27");

        when(
                regex.clean(
                        "Original words",
                        "en",
                        "Lesson"
                )
        ).thenReturn("Clean words");

        when(
                jobs.submit(
                        any(TranscriptResponse.class),
                        eq("Clean words"),
                        eq("Spanish")
                )
        ).thenReturn(
                new AiNoteJobService.Submission(
                        AiProcessingStatus.SKIPPED_UNAVAILABLE,
                        null,
                        "Gemini is cooling down after a provider error. "
                                + "Retry in about 30 seconds; "
                                + "your original draft is ready.",
                        30
                )
        );

        TranscriptResponse response =
                service(
                        extraction,
                        regex,
                        classifier,
                        jobs
                ).refineTranscript(
                        new RefineTranscriptRequest(
                                videoId,
                                "Original words",
                                List.of(
                                        new TranscriptSegmentDto(
                                                12,
                                                5,
                                                "Original words"
                                        )
                                ),
                                "en",
                                List.of(),
                                true,
                                "Spanish"
                        )
                );

        assertEquals(
                AiProcessingStatus.SKIPPED_UNAVAILABLE,
                response.aiStatus()
        );

        /*
         * No asynchronous job exists because the provider
         * cooldown blocked submission before queueing.
         */
        assertNull(
                response.aiJobId()
        );

        assertEquals(
                30,
                response.retryAfterSeconds()
        );

        assertEquals(
                "Spanish",
                response.targetLanguage()
        );

        assertTrue(
                response.aiRefinementEnabled()
        );

        assertTrue(
                response.aiMessage()
                        .contains("cooling down")
        );

        verify(classifier).validateEducationalContent(
                eq("Lesson"),
                eq("Learning Channel"),
                eq("27"),
                eq("Clean words"),
                eq("en"), any());

        verify(
                jobs,
                times(1)
        ).submit(
                any(TranscriptResponse.class),
                eq("Clean words"),
                eq("Spanish")
        );
    }

    private TranscriptCleaningServiceImpl service(
            VideoExtractionService extraction,
            RegexCleaningStrategy regex,
            EducationalContentClassifier classifier,
            AiNoteJobService jobs
    ) {

        return new TranscriptCleaningServiceImpl(
                extraction,
                regex,
                classifier,
                jobs,
                new PastedTranscriptParser(),
                new com.timesync.notes.service.note.TranscriptDraftFormatter(),
                new com.timesync.notes.integration.youtube.YoutubeSingleFlight(),
                new com.timesync.notes.integration.youtube.YoutubeTranscriptCache()
        );
    }

    private VideoExtractionService preparedExtraction(
            String videoId
    ) {

        VideoExtractionService extraction =
                mock(VideoExtractionService.class);

        when(
                extraction.getVideoTitle(videoId)
        ).thenReturn("Lesson");

        when(
                extraction.getVideoChannelName(videoId)
        ).thenReturn("Learning Channel");

        when(
                extraction.getVideoDuration(videoId)
        ).thenReturn("10:00");

        when(
                extraction.getVideoDescription(videoId)
        ).thenReturn("Course description");

        when(
                extraction.getVideoTags(videoId)
        ).thenReturn(
                List.of("education")
        );

        return extraction;
    }
}
