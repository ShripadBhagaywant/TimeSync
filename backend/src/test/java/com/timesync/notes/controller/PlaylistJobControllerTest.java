package com.timesync.notes.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timesync.notes.dto.response.PlaylistJobResponse;
import com.timesync.notes.service.PlaylistJobService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PlaylistJobControllerTest {

    private static final String JOB_ID = "123e4567-e89b-42d3-a456-426614174000";

    @Test
    void submitsAndPollsPlaylistJob() throws Exception {
        PlaylistJobService service = mock(PlaylistJobService.class);
        PlaylistJobResponse queued = new PlaylistJobResponse(
                JOB_ID,
                "abc12345",
                "QUEUED",
                "Playlist job is queued.",
                null,
                null,
                null,
                Instant.now(),
                Instant.now()
        );
        when(service.submit(any())).thenReturn(queued);
        when(service.get(JOB_ID)).thenReturn(queued);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new PlaylistJobController(service)).build();

        mockMvc.perform(post("/api/v1/extract/playlist/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(new ObjectMapper().writeValueAsString(java.util.Map.of(
                                "playlistUrl", "PL12345678901234567890",
                                "targetLanguage", "English",
                                "enableAiRefinement", true
                        ))))
                .andExpect(status().isAccepted())
                .andExpect(header().string(
                        "Location",
                        "http://localhost/api/v1/extract/playlist/jobs/" + JOB_ID
                ))
                .andExpect(jsonPath("$.status").value("QUEUED"));

        mockMvc.perform(get("/api/v1/extract/playlist/jobs/" + JOB_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobId").value(JOB_ID));
    }
}
