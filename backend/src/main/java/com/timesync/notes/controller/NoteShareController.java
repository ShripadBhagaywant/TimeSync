package com.timesync.notes.controller;

import com.timesync.notes.dto.request.ShareNoteRequest;
import com.timesync.notes.dto.response.SharedNoteResponse;
import com.timesync.notes.service.ShareNoteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
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
@RequestMapping("/api/v1/notes")
@RequiredArgsConstructor
@Validated
public class NoteShareController {

    private final ShareNoteService shareNoteService;

    @PostMapping(
            value = "/share",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<SharedNoteResponse> createShareSnapshot(@Valid @RequestBody ShareNoteRequest request) {
        log.info("Processing share request for video ID: {}", request.videoId());

        SharedNoteResponse response = shareNoteService.createShareSnapshot(request);

        // Safely construct the relative URI path without depending on HTTP Request context resolution
        URI location = UriComponentsBuilder.fromPath("/api/v1/notes/{hashId}")
                .buildAndExpand(response.hashId())
                .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(location);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .headers(headers)
                .body(response);
    }

    @GetMapping(
            value = "/{hashId}",
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<SharedNoteResponse> getSharedNote(
            @PathVariable
            @Pattern(regexp = "^[a-zA-Z0-9]{1,64}$", message = "Invalid shared-note ID")
            String hashId) {
        log.debug("Fetching shared snapshot");

        SharedNoteResponse response = shareNoteService.getNoteByHashId(hashId);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(response);
    }
}
