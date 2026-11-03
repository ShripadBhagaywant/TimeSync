package com.timesync.notes.service.impl;

import com.timesync.notes.dto.request.ShareNoteRequest;
import com.timesync.notes.dto.response.SharedNoteResponse;
import com.timesync.notes.entity.SharedNote;
import com.timesync.notes.exception.ResourceNotFoundException;
import com.timesync.notes.repository.SharedNoteRepository;
import com.timesync.notes.security.InputSanitizer;
import com.timesync.notes.service.ShareNoteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShareNoteServiceImpl implements ShareNoteService {

    private final SharedNoteRepository sharedNoteRepository;
    private final InputSanitizer inputSanitizer;

    @Value("${app.sharing.default-ttl-hours:24}")
    private long defaultTtlHours;

    @Value("${app.sharing.public-base-url}")
    private String publicBaseUrl;

    @Override
    @Transactional
    public SharedNoteResponse createShareSnapshot(ShareNoteRequest request)
    {

        log.info("Persisting share snapshot for video ID: {}", request.videoId());

        Instant expiresAt = Instant.now().plus(defaultTtlHours, ChronoUnit.HOURS);

        SharedNote note = SharedNote.builder().hashId(UUID.randomUUID().toString().replace("-", ""))
                        .videoId(request.videoId())
                        .videoTitle(inputSanitizer.sanitize(request.videoTitle()))
                        .noteContent(inputSanitizer.sanitizeRichHtml(request.noteContent()))
                        .cleaningStage(request.cleaningStage())
                        .expiresAt(expiresAt)
                        .build();

        // The public token must not reveal or be predictable from the database ID.
        SharedNote savedNote = sharedNoteRepository.saveAndFlush(note);

        return toResponse(savedNote);
    }

    @Override
    @Transactional(readOnly = true)
    public SharedNoteResponse getNoteByHashId(String hashId) {

        log.debug("Fetching shared note snapshot");

        SharedNote sharedNote = sharedNoteRepository.findByHashId(hashId)
                        .orElseThrow(
                                () -> new ResourceNotFoundException("Shared note reference not found.")
                        );

        if (isExpired(sharedNote)) {

            log.debug("Shared note access link expired");

            throw new ResourceNotFoundException("Shared note access link has expired.");
        }

        return toResponse(sharedNote);
    }

    private boolean isExpired(SharedNote note) {

        Instant expiresAt = note.getExpiresAt();

        if (expiresAt == null) {
            return false;
        }

        /*
         * Treat equality as expired as well.
         */
        return !expiresAt.isAfter(Instant.now());
    }

    private SharedNoteResponse toResponse(SharedNote note) {

        return new SharedNoteResponse(note.getHashId(),
                publicShareUrl(note.getHashId()),
                note.getVideoId(),
                inputSanitizer.sanitize(note.getVideoTitle()),
                inputSanitizer.sanitizeRichHtml(note.getNoteContent()),
                note.getCleaningStage(),
                note.getCreatedAt(),
                note.getExpiresAt()
        );
    }

    private String publicShareUrl(String hashId) {

        String normalizedBaseUrl = normalizePublicBaseUrl(publicBaseUrl);

        return normalizedBaseUrl + "/notes/" + hashId;
    }

    private String normalizePublicBaseUrl(String baseUrl)
    {

        if (baseUrl == null || baseUrl.isBlank()) {
            return "";
        }

        String normalized = baseUrl.trim();

        while (normalized.endsWith("/") && normalized.length() > 1) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }

        return normalized;
    }
}
