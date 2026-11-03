package com.timesync.notes.service;

import com.timesync.notes.dto.request.ExtractPlaylistRequest;
import com.timesync.notes.dto.response.PlaylistJobResponse;
import com.timesync.notes.dto.response.PlaylistTranscriptResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PlaylistJobServiceTest {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
    }

    @Test
    void completesPlaylistWorkOutsideTheSubmittingThread() throws InterruptedException {
        PlaylistExtractionService extractionService = mock(PlaylistExtractionService.class);
        PlaylistTranscriptResponse expected = PlaylistTranscriptResponse.builder()
                .playlistId("PL12345678901234567890")
                .playlistTitle("Playlist")
                .totalVideos(120)
                .attemptedVideos(120)
                .processedVideos(120)
                .videoNotes(List.of())
                .failures(List.of())
                .maxVideos(250)
                .build();
        when(extractionService.extractPlaylist(any())).thenReturn(expected);
        PlaylistJobService service = new PlaylistJobService(extractionService, executor);

        PlaylistJobResponse submitted = service.submit(
                new ExtractPlaylistRequest("PL12345678901234567890", "English", true)
        );
        assertNotNull(submitted.jobId());

        PlaylistJobResponse completed = awaitTerminalState(service, submitted.jobId());
        assertEquals("COMPLETED", completed.status());
        assertEquals(expected, completed.result());
    }

    private PlaylistJobResponse awaitTerminalState(PlaylistJobService service, String jobId)
            throws InterruptedException {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(2));
        PlaylistJobResponse response = service.get(jobId);
        while (!"COMPLETED".equals(response.status()) && !"FAILED".equals(response.status())) {
            if (Instant.now().isAfter(deadline)) {
                throw new AssertionError("Playlist job did not complete in time");
            }
            Thread.sleep(10);
            response = service.get(jobId);
        }
        return response;
    }
}
