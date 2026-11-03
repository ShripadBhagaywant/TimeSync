package com.timesync.notes.controller;

import com.timesync.notes.dto.request.ExtractVideoRequest;
import com.timesync.notes.dto.request.ImportTranscriptRequest;
import com.timesync.notes.dto.request.RefineTranscriptRequest;
import com.timesync.notes.dto.response.TranscriptResponse;
import com.timesync.notes.service.TranscriptCleaningService;
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
public class ExtractionController {

    private final TranscriptCleaningService transcriptCleaningService;

    @PostMapping(
            value = "/video",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<TranscriptResponse> extractVideoTranscript(
            @Valid @RequestBody ExtractVideoRequest request,
            UriComponentsBuilder uriBuilder) {

        log.info("Processing source-only video extraction request.");

        TranscriptResponse response = transcriptCleaningService.extractAndProcess(request);

        URI location = uriBuilder
                .path("/api/v1/extract/video/{id}")
                .buildAndExpand(response.videoId())
                .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(location);

        return ResponseEntity
                .status(HttpStatus.OK)
                .headers(headers)
                .body(response);
    }

    @PostMapping(value = "/video/transcript", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<TranscriptResponse> importTranscript(
            @Valid @RequestBody ImportTranscriptRequest request) {
        log.info("Processing user-provided timestamped transcript for video ID: {}", request.videoId());
        return ResponseEntity.ok(transcriptCleaningService.importTranscript(request));
    }

    @PostMapping(value = "/video/refine", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<TranscriptResponse> refineTranscript(
            @Valid @RequestBody RefineTranscriptRequest request) {
        log.info("Received workspace AI refinement request for video ID: {}; output language: {}",
                request.videoId(), request.targetLanguage());
        return ResponseEntity.accepted().body(transcriptCleaningService.refineTranscript(request));
    }

    @GetMapping(
            value = "/video/{id}",
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<TranscriptResponse> getVideoById(
            @PathVariable("id")
            @Pattern(regexp = "^[a-zA-Z0-9_-]{11}$", message = "Invalid YouTube video ID")
            String videoId) {
        // A read endpoint must not silently spend AI quota. It restores the stable source draft.
        ExtractVideoRequest req = new ExtractVideoRequest("https://www.youtube.com/watch?v=" + videoId);

        TranscriptResponse response = transcriptCleaningService.extractAndProcess(req);
        return ResponseEntity.ok(response);
    }
}
