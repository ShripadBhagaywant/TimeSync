package com.timesync.notes.controller;

import com.timesync.notes.dto.request.ExtractPlaylistRequest;
import com.timesync.notes.dto.response.PlaylistJobResponse;
import com.timesync.notes.service.PlaylistJobService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/extract/playlist/jobs")
@RequiredArgsConstructor
@Validated
public class PlaylistJobController {

    private final PlaylistJobService playlistJobService;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<PlaylistJobResponse> submit(
            @Valid @RequestBody ExtractPlaylistRequest request,
            UriComponentsBuilder uriBuilder) {
        PlaylistJobResponse job = playlistJobService.submit(request);
        URI location = uriBuilder
                .path("/api/v1/extract/playlist/jobs/{jobId}")
                .buildAndExpand(job.jobId())
                .toUri();
        return ResponseEntity.accepted().location(location).body(job);
    }

    @GetMapping(value = "/{jobId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<PlaylistJobResponse> get(
            @PathVariable
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
                    message = "Invalid playlist job ID"
            )
            String jobId) {
        return ResponseEntity.ok(playlistJobService.get(jobId));
    }
}
