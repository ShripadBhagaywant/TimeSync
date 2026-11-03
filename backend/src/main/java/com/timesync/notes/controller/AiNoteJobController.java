package com.timesync.notes.controller;

import com.timesync.notes.dto.response.AiNoteJobResponse;
import com.timesync.notes.service.AiNoteJobService;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/extract/ai/jobs")
@RequiredArgsConstructor
@Validated
public class AiNoteJobController {

    private final AiNoteJobService aiNoteJobService;

    @GetMapping(value = "/{jobId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AiNoteJobResponse> get(
            @PathVariable
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
                    message = "Invalid AI job ID"
            ) String jobId) {
        return ResponseEntity.ok(aiNoteJobService.get(jobId));
    }
}
