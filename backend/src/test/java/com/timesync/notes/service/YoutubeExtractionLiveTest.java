package com.timesync.notes.service;
import com.timesync.notes.model.ExtractedTranscript;
import com.timesync.notes.integration.youtube.YoutubeAvailabilityGuard;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timesync.notes.service.impl.YoutubeDataApiService;
import com.timesync.notes.service.impl.YoutubeExtractionServiceImpl;
import com.timesync.notes.integration.youtube.YoutubePlayerResponseClient;
import com.timesync.notes.service.impl.YoutubeCaptionCircuitBreaker;
import com.timesync.notes.config.RestClientConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class YoutubeExtractionLiveTest {

    @Test
    @EnabledIfEnvironmentVariable(named = "RUN_LIVE_YOUTUBE_TEST", matches = "true")
    void extractsARealTimedTranscript() {
        RestClient restClient = new RestClientConfig().restClient(new com.timesync.notes.integration.youtube.YoutubeAvailabilityGuard(60, 600));
        YoutubeExtractionServiceImpl service = new YoutubeExtractionServiceImpl(
                restClient,
                new YoutubeDataApiService(restClient),
                new YoutubePlayerResponseClient(restClient, "https://www.youtube.com/watch"),
                new ObjectMapper(),
                new YoutubeCaptionCircuitBreaker(600, 3600)
        );
        ReflectionTestUtils.setField(
                service,
                "timedTextBaseUrl",
                "https://www.youtube.com/api/timedtext"
        );

        ExtractedTranscript transcript = service.extractTranscript("dQw4w9WgXcQ", "English");

        assertTrue(transcript.content().length() >= 20);
        assertFalse(transcript.segments().isEmpty());
    }
}
