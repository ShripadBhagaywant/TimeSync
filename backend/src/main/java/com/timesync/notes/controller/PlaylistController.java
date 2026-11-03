package com.timesync.notes.controller;

import com.timesync.notes.dto.request.ExtractPlaylistRequest;
import com.timesync.notes.dto.response.PlaylistTranscriptResponse;
import com.timesync.notes.service.PlaylistExtractionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Pattern;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@Slf4j
@RestController
@RequestMapping("/api/v1/extract")
@RequiredArgsConstructor
@Validated
public class PlaylistController {

    private final PlaylistExtractionService playlistExtractionService;

    @PostMapping(
            value = "/playlist",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<PlaylistTranscriptResponse> extractPlaylist(
            @Valid @RequestBody ExtractPlaylistRequest request,
            UriComponentsBuilder uriBuilder) {

        log.info("Processing batch playlist extraction request.");

        PlaylistTranscriptResponse response = playlistExtractionService.extractPlaylist(request);

        URI location = uriBuilder
                .path("/api/v1/extract/playlist/{id}")
                .buildAndExpand(response.playlistId())
                .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(location);

        return ResponseEntity
                .status(HttpStatus.OK)
                .headers(headers)
                .body(response);
    }

    @GetMapping(
            value = "/playlist/{id}",
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<PlaylistTranscriptResponse> getPlaylistById(
            @PathVariable("id")
            @Pattern(regexp = "^[a-zA-Z0-9_-]{12,100}$", message = "Invalid YouTube playlist ID")
            String playlistId) {
        // Refresh the stable, cacheable source notes without starting a new AI job per video.
        ExtractPlaylistRequest req = new ExtractPlaylistRequest(playlistId);
        PlaylistTranscriptResponse response = playlistExtractionService.extractPlaylist(req);
        return ResponseEntity.ok(response);
    }
}
