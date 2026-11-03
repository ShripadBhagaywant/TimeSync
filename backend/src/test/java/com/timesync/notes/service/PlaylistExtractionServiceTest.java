package com.timesync.notes.service;
import com.timesync.notes.integration.youtube.YoutubeAvailabilityGuard;

import com.timesync.notes.dto.request.ExtractPlaylistRequest;
import com.timesync.notes.dto.response.PlaylistTranscriptResponse;
import com.timesync.notes.dto.response.TranscriptResponse;
import com.timesync.notes.entity.CleaningStage;
import com.timesync.notes.entity.NoteSource;
import com.timesync.notes.entity.TranscriptAvailability;
import com.timesync.notes.exception.ApiException;
import com.timesync.notes.exception.UnprocessableVideoException;
import com.timesync.notes.exception.UpstreamRateLimitException;
import com.timesync.notes.service.impl.PlaylistExtractionServiceImpl;
import com.timesync.notes.service.impl.YoutubeDataApiService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PlaylistExtractionServiceTest {

    private static final String PLAYLIST_ID = "PL12345678901234567890";

    private final TranscriptCleaningService transcriptService = mock(TranscriptCleaningService.class);
    private final YoutubeDataApiService youtubeDataApiService = mock(YoutubeDataApiService.class);
    private ExecutorService executor;
    private PlaylistExtractionServiceImpl service;
    private List<String> videoIds;

    @BeforeEach
    void setUp() {
        executor = Executors.newFixedThreadPool(4);
        service = new PlaylistExtractionServiceImpl(
                transcriptService,
                youtubeDataApiService,
                executor,
                8,
                30,
                250,
                new YoutubeAvailabilityGuard(60, 600)
        );
        videoIds = IntStream.range(0, 120)
                .mapToObj(index -> "%011d".formatted(index))
                .toList();
        when(youtubeDataApiService.getPlaylistMetadata(PLAYLIST_ID))
                .thenReturn(new YoutubeDataApiService.PlaylistMetadata("Large Playlist", ""));
        when(youtubeDataApiService.getPlaylistVideoIds(PLAYLIST_ID))
                .thenReturn(new YoutubeDataApiService.PlaylistVideoCollection(videoIds, 120, false));
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
    }

    @Test
    void processesLargePlaylistAndStopsAfterFullyRateLimitedBatch() {
        AtomicInteger calls = new AtomicInteger();
        when(transcriptService.extractAndProcess(any())).thenAnswer(invocation -> {
            int call = calls.getAndIncrement();
            if (call < 8) {
                return transcript(videoIds.get(call));
            }
            throw new UpstreamRateLimitException("YouTube rate limited the request.");
        });

        PlaylistTranscriptResponse result = service.extractPlaylist(
                new ExtractPlaylistRequest(PLAYLIST_ID, "English", true)
        );

        assertEquals(16, result.attemptedVideos());
        assertEquals(8, result.processedVideos());
        assertEquals(112, result.failedVideos());
        assertEquals(104, result.skippedVideos());
        assertTrue(result.stoppedEarly());
        assertEquals(120, result.totalVideos());
        verify(transcriptService, org.mockito.Mockito.times(16)).extractAndProcess(any());
    }

    @Test
    void returnsRateLimitWhenFirstBatchCannotProcessAnyVideo() {
        when(transcriptService.extractAndProcess(any())).thenThrow(
                new UpstreamRateLimitException("YouTube rate limited the request.")
        );

        assertThrows(
                UpstreamRateLimitException.class,
                () -> service.extractPlaylist(new ExtractPlaylistRequest(PLAYLIST_ID, "English", false))
        );
        verify(transcriptService, org.mockito.Mockito.times(8)).extractAndProcess(any());
    }

    @Test
    void retainsCompatibilityErrorForLegacyCaptionFailures() {
        List<String> captionlessVideos = videoIds.subList(0, 3);
        List<String> observedTraceIds = new CopyOnWriteArrayList<>();
        when(youtubeDataApiService.getPlaylistVideoIds(PLAYLIST_ID))
                .thenReturn(new YoutubeDataApiService.PlaylistVideoCollection(captionlessVideos, 3, false));
        when(transcriptService.extractAndProcess(any())).thenAnswer(invocation -> {
            observedTraceIds.add(MDC.get("traceId"));
            throw new UnprocessableVideoException(
                        "No accessible captions are available for this video.",
                        "CAPTIONS_UNAVAILABLE"
                );
        });

        ApiException exception;
        try (MDC.MDCCloseable ignored = MDC.putCloseable("traceId", "playlist-test-trace")) {
            exception = assertThrows(
                    ApiException.class,
                    () -> service.extractPlaylist(new ExtractPlaylistRequest(PLAYLIST_ID, "English", false))
            );
        }

        assertEquals("PLAYLIST_CAPTIONS_UNAVAILABLE", exception.getErrorCode());
        assertEquals(List.of("playlist-test-trace"), observedTraceIds.stream().distinct().toList());
        verify(transcriptService, org.mockito.Mockito.times(3)).extractAndProcess(any());
    }

    @Test
    void keepsCaptionAndMetadataNotesTogetherInMixedPlaylist() {
        List<String> mixedVideos = videoIds.subList(0, 2);
        when(youtubeDataApiService.getPlaylistVideoIds(PLAYLIST_ID))
                .thenReturn(new YoutubeDataApiService.PlaylistVideoCollection(mixedVideos, 2, false));
        when(transcriptService.extractAndProcess(any())).thenAnswer(invocation -> {
            String requestedVideoId = ((com.timesync.notes.dto.request.ExtractVideoRequest) invocation.getArgument(0))
                    .url().substring("https://www.youtube.com/watch?v=".length());
            if (requestedVideoId.equals(mixedVideos.get(0))) {
                return transcript(requestedVideoId);
            }
            return metadataTranscript(requestedVideoId);
        });

        PlaylistTranscriptResponse result = service.extractPlaylist(
                new ExtractPlaylistRequest(PLAYLIST_ID, "Hindi", true));

        assertEquals(2, result.processedVideos());
        assertEquals(1, result.captionVideos());
        assertEquals(1, result.metadataVideos());
        assertEquals(0, result.temporarilyUnavailableVideos());
        assertEquals(0, result.failedVideos());
    }

    @Test
    void allPermanentlyCaptionlessVideosRemainUsablePlaylistItems() {
        when(transcriptService.extractAndProcess(any())).thenAnswer(invocation -> {
            String url = ((com.timesync.notes.dto.request.ExtractVideoRequest) invocation.getArgument(0)).url();
            return metadataTranscript(url.substring(url.indexOf("v=") + 2));
        });
        var result = service.extractPlaylist(new ExtractPlaylistRequest(PLAYLIST_ID));
        assertEquals(120, result.processedVideos());
        assertEquals(120, result.metadataVideos());
        assertEquals(0, result.failedVideos());
        assertEquals(0, result.temporarilyUnavailableVideos());
    }

    @Test
    void retainsEachVideoDecisionAndSkipsRejectedItems() {
        var ids = videoIds.subList(0, 3);
        when(youtubeDataApiService.getPlaylistVideoIds(PLAYLIST_ID))
                .thenReturn(new YoutubeDataApiService.PlaylistVideoCollection(ids, 3, false));
        when(transcriptService.extractAndProcess(any())).thenAnswer(call -> {
            String url = ((com.timesync.notes.dto.request.ExtractVideoRequest) call.getArgument(0)).url();
            String id = url.substring(url.indexOf("v=") + 2);
            if (id.equals(ids.get(0))) return transcript(id).withContentPolicy(
                    com.timesync.notes.guardrail.ContentPolicyDecision.semantic(com.timesync.notes.entity.ContentEligibility.INFORMATIONAL));
            if (id.equals(ids.get(1))) return metadataTranscript(id);
            throw new com.timesync.notes.exception.NonEducationalContentException(
                    new com.timesync.notes.guardrail.MetadataContentPolicy().evaluate("Official Movie Trailer", "", "24"));
        });
        var result = service.extractPlaylist(new ExtractPlaylistRequest(PLAYLIST_ID));
        assertEquals(2, result.processedVideos());
        assertEquals(1, result.failedVideos());
        assertEquals("NON_EDUCATIONAL_CONTENT", result.failures().get(0).code());
        var approved = result.videoNotes().stream().filter(video -> video.videoId().equals(ids.get(0))).findFirst().orElseThrow();
        var unknown = result.videoNotes().stream().filter(video -> video.videoId().equals(ids.get(1))).findFirst().orElseThrow();
        assertEquals(com.timesync.notes.entity.ContentEligibility.INFORMATIONAL, approved.contentEligibility());
        assertEquals(com.timesync.notes.guardrail.VerificationLevel.SEMANTIC_VERIFIED, approved.verificationLevel());
        assertEquals(com.timesync.notes.entity.ContentEligibility.UNKNOWN, unknown.contentEligibility());
        assertEquals(com.timesync.notes.guardrail.VerificationLevel.UNVERIFIED, unknown.verificationLevel());
        org.mockito.Mockito.verify(transcriptService, org.mockito.Mockito.times(3)).extractAndProcess(any());
    }

    private TranscriptResponse transcript(String videoId) {
        return new TranscriptResponse(
                videoId,
                "Video " + videoId,
                "Channel",
                "",
                "Raw transcript",
                List.of(),
                "01:00",
                "Notes",
                CleaningStage.REGEX_SANITIZED,
                NoteSource.CAPTIONS,
                "",
                List.of(),
                true,
                false,
                TranscriptAvailability.AVAILABLE,
                "en",
                "English",
                false,
                null
        );
    }

    private TranscriptResponse metadataTranscript(String videoId) {
        return new TranscriptResponse(
                videoId, "Video " + videoId, "Channel", "", "", List.of(), "01:00",
                "", CleaningStage.METADATA_FALLBACK, NoteSource.METADATA,
                "Transcript unavailable", List.of(), true, false,
                TranscriptAvailability.UNAVAILABLE, "", "Original", false, null
        );
    }
    @Test
    void allBusyItemsRemainTemporary503() {
        when(transcriptService.extractAndProcess(any())).thenThrow(
                new com.timesync.notes.exception.YoutubeBusyException("busy"));
        var failure = assertThrows(com.timesync.notes.exception.YoutubeBusyException.class,
                () -> service.extractPlaylist(new ExtractPlaylistRequest(PLAYLIST_ID, "English", false)));
        org.junit.jupiter.api.Assertions.assertEquals(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, failure.getStatus());
    }

    @Test
    void busyItemsDoNotDiscardPartialSuccess() {
        when(transcriptService.extractAndProcess(any())).thenReturn(transcript(videoIds.get(0))).thenThrow(
                new com.timesync.notes.exception.YoutubeBusyException("busy"));
        var result = service.extractPlaylist(new ExtractPlaylistRequest(PLAYLIST_ID, "English", false));
        org.junit.jupiter.api.Assertions.assertEquals(1, result.processedVideos());
        org.junit.jupiter.api.Assertions.assertEquals(119, result.failedVideos());
        org.junit.jupiter.api.Assertions.assertTrue(result.failures().stream().allMatch(item -> "YOUTUBE_BUSY".equals(item.code())));
    }}
