package com.timesync.notes.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timesync.notes.dto.response.AiNoteJobResponse;
import com.timesync.notes.dto.response.PlaylistTranscriptResponse;
import com.timesync.notes.dto.response.SharedNoteResponse;
import com.timesync.notes.dto.response.TranscriptResponse;
import com.timesync.notes.entity.AiProcessingStatus;
import com.timesync.notes.entity.CleaningStage;
import com.timesync.notes.entity.NoteSource;
import com.timesync.notes.entity.TranscriptAvailability;
import com.timesync.notes.exception.GlobalExceptionHandler;
import com.timesync.notes.exception.UpstreamRateLimitException;
import com.timesync.notes.exception.UpstreamServiceUnavailableException;
import com.timesync.notes.service.AiNoteJobService;
import com.timesync.notes.service.PlaylistExtractionService;
import com.timesync.notes.service.ShareNoteService;
import com.timesync.notes.service.TranscriptCleaningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EndpointContractTest {

    private static final String VIDEO_ID = "dQw4w9WgXcQ";
    private static final String PLAYLIST_ID = "PL12345678901234567890";

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        TranscriptCleaningService transcriptService =
                mock(TranscriptCleaningService.class);

        PlaylistExtractionService playlistService =
                mock(PlaylistExtractionService.class);

        ShareNoteService shareService =
                mock(ShareNoteService.class);

        TranscriptResponse transcript =
                new TranscriptResponse(
                        VIDEO_ID,
                        "Video",
                        "Channel",
                        "https://example.com/thumb.jpg",
                        "Raw transcript content",
                        List.of(),
                        "01:00",
                        "Clean notes",
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

        PlaylistTranscriptResponse playlist =
                PlaylistTranscriptResponse.builder()
                        .playlistId(PLAYLIST_ID)
                        .playlistTitle("Playlist")
                        .playlistThumbnailUrl("")
                        .totalVideos(120)
                        .attemptedVideos(120)
                        .processedVideos(119)
                        .failedVideos(1)
                        .videoNotes(List.of(transcript))
                        .failures(List.of())
                        .truncated(false)
                        .maxVideos(250)
                        .cachedResponse(false)
                        .build();

        SharedNoteResponse sharedNote =
                new SharedNoteResponse(
                        "abc123",
                        "http://localhost:5173/notes/abc123",
                        VIDEO_ID,
                        "Video",
                        "<p>Notes</p>",
                        CleaningStage.REGEX_SANITIZED,
                        Instant.now(),
                        Instant.now().plusSeconds(3600)
                );

        when(transcriptService.extractAndProcess(any()))
                .thenReturn(transcript);

        when(playlistService.extractPlaylist(any()))
                .thenReturn(playlist);

        when(shareService.createShareSnapshot(any()))
                .thenReturn(sharedNote);

        when(shareService.getNoteByHashId("abc123"))
                .thenReturn(sharedNote);

        mockMvc =
                MockMvcBuilders.standaloneSetup(
                                new ExtractionController(transcriptService),
                                new PlaylistController(playlistService),
                                new NoteShareController(shareService)
                        )
                        .setControllerAdvice(
                                new GlobalExceptionHandler()
                        )
                        .build();
    }

    @Test
    void videoPostAndGetContractsWork() throws Exception {
        mockMvc.perform(
                        post("/api/v1/extract/video")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        new ObjectMapper()
                                                .writeValueAsString(
                                                        java.util.Map.of(
                                                                "url",
                                                                "https://youtu.be/" + VIDEO_ID,
                                                                "targetLanguage",
                                                                "English",
                                                                "enableAiRefinement",
                                                                false
                                                        )
                                                )
                                )
                )
                .andExpect(status().isOk())
                .andExpect(
                        header().string(
                                "Location",
                                "http://localhost/api/v1/extract/video/"
                                        + VIDEO_ID
                        )
                )
                .andExpect(
                        jsonPath("$.videoId")
                                .value(VIDEO_ID)
                );

        mockMvc.perform(
                        get("/api/v1/extract/video/" + VIDEO_ID)
                )
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.cleanedTranscript")
                                .value("Clean notes")
                );
    }

    @Test
    void playlistPostAndGetContractsWorkForLargePlaylists()
            throws Exception {

        mockMvc.perform(
                        post("/api/v1/extract/playlist")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        new ObjectMapper()
                                                .writeValueAsString(
                                                        java.util.Map.of(
                                                                "playlistUrl",
                                                                "https://youtube.com/playlist?list="
                                                                        + PLAYLIST_ID,
                                                                "targetLanguage",
                                                                "English",
                                                                "enableAiRefinement",
                                                                false
                                                        )
                                                )
                                )
                )
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.totalVideos")
                                .value(120)
                )
                .andExpect(
                        jsonPath("$.processedVideos")
                                .value(119)
                );

        mockMvc.perform(
                        get("/api/v1/extract/playlist/" + PLAYLIST_ID)
                )
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.playlistId")
                                .value(PLAYLIST_ID)
                );
    }

    @Test
    void sharedNotePostAndGetContractsWork()
            throws Exception {

        mockMvc.perform(
                        post("/api/v1/notes/share")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        new ObjectMapper()
                                                .writeValueAsString(
                                                        java.util.Map.of(
                                                                "videoId",
                                                                VIDEO_ID,
                                                                "videoTitle",
                                                                "Video",
                                                                "noteContent",
                                                                "<p>Notes</p>",
                                                                "cleaningStage",
                                                                "REGEX_SANITIZED"
                                                        )
                                                )
                                )
                )
                .andExpect(status().isCreated())
                .andExpect(
                        header().string(
                                "Location",
                                "/api/v1/notes/abc123"
                        )
                )
                .andExpect(
                        jsonPath("$.hashId")
                                .value("abc123")
                );

        mockMvc.perform(
                        get("/api/v1/notes/abc123")
                )
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.noteContent")
                                .value("<p>Notes</p>")
                );
    }

    @Test
    void aiJobPollingContractWorks()
            throws Exception {

        String jobId =
                "123e4567-e89b-42d3-a456-426614174000";

        AiNoteJobService aiNoteJobService =
                mock(AiNoteJobService.class);

        when(aiNoteJobService.get(jobId))
                .thenReturn(
                        new AiNoteJobResponse(
                                jobId,
                                AiProcessingStatus.PROCESSING,
                                "Structuring notes",
                                null,
                                null,
                                Instant.now(),
                                Instant.now()
                        )
                );

        MockMvc aiMockMvc =
                MockMvcBuilders.standaloneSetup(
                                new AiNoteJobController(
                                        aiNoteJobService
                                )
                        )
                        .setControllerAdvice(
                                new GlobalExceptionHandler()
                        )
                        .build();

        aiMockMvc.perform(
                        get(
                                "/api/v1/extract/ai/jobs/"
                                        + jobId
                        )
                )
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.status")
                                .value("PROCESSING")
                )
                .andExpect(
                        jsonPath("$.retryAfterSeconds")
                                .doesNotExist()
                );
    }

    @Test
    void aiJobPollingReturnsRetryAfterForProviderUnavailable()
            throws Exception {

        String jobId =
                "123e4567-e89b-42d3-a456-426614174001";

        AiNoteJobService aiNoteJobService =
                mock(AiNoteJobService.class);

        TranscriptResponse result =
                new TranscriptResponse(
                        VIDEO_ID,
                        "Video",
                        "Channel",
                        "",
                        "Raw transcript",
                        List.of(),
                        "01:00",
                        "Original draft",
                        CleaningStage.REGEX_SANITIZED,
                        NoteSource.CAPTIONS,
                        "",
                        List.of(),
                        true,
                        false,
                        TranscriptAvailability.AVAILABLE,
                        "en",
                        "English",
                        true,
                        30
                );

        when(aiNoteJobService.get(jobId))
                .thenReturn(
                        new AiNoteJobResponse(
                                jobId,
                                AiProcessingStatus.FAILED,
                                "Gemini is temporarily under high demand.",
                                result,
                                30,
                                Instant.now(),
                                Instant.now()
                        )
                );

        MockMvc aiMockMvc =
                MockMvcBuilders.standaloneSetup(
                                new AiNoteJobController(
                                        aiNoteJobService
                                )
                        )
                        .setControllerAdvice(
                                new GlobalExceptionHandler()
                        )
                        .build();

        aiMockMvc.perform(
                        get(
                                "/api/v1/extract/ai/jobs/"
                                        + jobId
                        )
                )
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.status")
                                .value("FAILED")
                )
                .andExpect(
                        jsonPath("$.retryAfterSeconds")
                                .value(30)
                )
                .andExpect(
                        jsonPath("$.result.retryAfterSeconds")
                                .value(30)
                );
    }

    @Test
    void upstreamTranscriptFailureReturnsBadGatewayProblemDetail()
            throws Exception {

        TranscriptCleaningService failingService =
                mock(TranscriptCleaningService.class);

        when(failingService.extractAndProcess(any()))
                .thenThrow(
                        new UpstreamServiceUnavailableException(
                                "YouTube caption service is unavailable.",
                                new IllegalStateException(
                                        "redirect loop"
                                )
                        )
                );

        MockMvc failingMockMvc =
                MockMvcBuilders.standaloneSetup(
                                new ExtractionController(
                                        failingService
                                )
                        )
                        .setControllerAdvice(
                                new GlobalExceptionHandler()
                        )
                        .build();

        failingMockMvc.perform(
                        post("/api/v1/extract/video")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        new ObjectMapper()
                                                .writeValueAsString(
                                                        java.util.Map.of(
                                                                "url",
                                                                "https://youtu.be/"
                                                                        + VIDEO_ID,
                                                                "targetLanguage",
                                                                "English",
                                                                "enableAiRefinement",
                                                                false
                                                        )
                                                )
                                )
                )
                .andExpect(
                        status().isBadGateway()
                )
                .andExpect(
                        jsonPath("$.code")
                                .value(
                                        "UPSTREAM_SERVICE_UNAVAILABLE"
                                )
                );
    }

    @Test
    void youtubeRateLimitReturnsRetryableProblemDetail()
            throws Exception {

        TranscriptCleaningService rateLimitedService =
                mock(TranscriptCleaningService.class);

        when(rateLimitedService.extractAndProcess(any()))
                .thenThrow(
                        new UpstreamRateLimitException(
                                "YouTube is temporarily rate limiting requests.", 47
                        )
                );

        MockMvc rateLimitedMockMvc =
                MockMvcBuilders.standaloneSetup(
                                new ExtractionController(
                                        rateLimitedService
                                )
                        )
                        .setControllerAdvice(
                                new GlobalExceptionHandler()
                        )
                        .build();

        rateLimitedMockMvc.perform(
                        post("/api/v1/extract/video")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        new ObjectMapper()
                                                .writeValueAsString(
                                                        java.util.Map.of(
                                                                "url",
                                                                "https://youtu.be/"
                                                                        + VIDEO_ID,
                                                                "targetLanguage",
                                                                "English",
                                                                "enableAiRefinement",
                                                                false
                                                        )
                                                )
                                )
                )
                .andExpect(
                        status().isTooManyRequests()
                )
                .andExpect(
                        header().string(
                                "Retry-After",
                                "47"
                        )
                )
                .andExpect(jsonPath("$.retryAfterSeconds").value(47))
                .andExpect(jsonPath("$.traceId").isNotEmpty())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(
                        jsonPath("$.code")
                                .value(
                                        "YOUTUBE_RATE_LIMITED"
                                )
                );
    }
    @Test
    void youtubeBusyUses503WithoutRateLimitHeader() throws Exception {
        var service = mock(TranscriptCleaningService.class);
        when(service.extractAndProcess(any())).thenThrow(
                new com.timesync.notes.exception.YoutubeBusyException("YouTube requests are busy."));
        var mvc = MockMvcBuilders.standaloneSetup(new ExtractionController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(get("/api/v1/extract/video/" + VIDEO_ID))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("YOUTUBE_BUSY"))
                .andExpect(header().doesNotExist("Retry-After"));
    }}