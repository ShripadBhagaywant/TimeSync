package com.timesync.notes.service;

import com.timesync.notes.dto.request.ShareNoteRequest;
import com.timesync.notes.dto.response.SharedNoteResponse;
import com.timesync.notes.entity.CleaningStage;
import com.timesync.notes.entity.SharedNote;
import com.timesync.notes.exception.ResourceNotFoundException;
import com.timesync.notes.repository.SharedNoteRepository;
import com.timesync.notes.security.InputSanitizer;
import com.timesync.notes.service.impl.ShareNoteServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShareNoteServiceTest {

    @Test
    void persistsSanitizedSnapshotForEveryCleaningStageIncludingMetadataFallback() {

        SharedNoteRepository repository =
                mock(SharedNoteRepository.class);

        ShareNoteServiceImpl service =
                service(repository);

        when(
                repository.save(
                        any(SharedNote.class)
                )
        ).thenAnswer(invocation -> {

            SharedNote note =
                    invocation.getArgument(0);

            note.setId(42L);
            note.setCreatedAt(
                    Instant.now()
            );
            note.setUpdatedAt(
                    Instant.now()
            );

            return note;
        });

        when(
                repository.saveAndFlush(
                        any(SharedNote.class)
                )
        ).thenAnswer(
                invocation ->
                        invocation.getArgument(0)
        );

        Instant beforeCreation =
                Instant.now();

        SharedNoteResponse response =
                service.createShareSnapshot(
                        new ShareNoteRequest(
                                "yE6tIle64tU",
                                "<b>SQL Tutorial</b>",
                                "<p onclick=\"steal()\">Safe notes</p>"
                                        + "<script>alert(1)</script>",
                                CleaningStage.METADATA_FALLBACK
                        )
                );

        Instant afterCreation =
                Instant.now();

        assertTrue(response.hashId().matches("[a-f0-9]{32}"));

        assertEquals(
                "SQL Tutorial",
                response.videoTitle()
        );

        assertTrue(
                response.noteContent()
                        .contains("Safe notes")
        );

        assertFalse(
                response.noteContent()
                        .contains("onclick")
        );

        assertFalse(
                response.noteContent()
                        .contains("script")
        );

        assertEquals(
                CleaningStage.METADATA_FALLBACK,
                response.cleaningStage()
        );

        assertEquals(
                "http://localhost:5173/notes/" + response.hashId(),
                response.shareUrl()
        );

        /*
         * Default test configuration is 24 hours.
         *
         * Use a time window instead of asserting against an exact Instant,
         * because a small amount of execution time passes during creation.
         */
        assertTrue(
                response.expiresAt()
                        .isAfter(
                                beforeCreation.plus(
                                        23,
                                        ChronoUnit.HOURS
                                )
                        )
        );

        assertTrue(
                response.expiresAt()
                        .isBefore(
                                afterCreation.plus(
                                        25,
                                        ChronoUnit.HOURS
                                )
                        )
        );

        verify(
                repository
        ).saveAndFlush(
                any(SharedNote.class)
        );
    }

    @Test
    void expiredSnapshotIsNeverReturnedEvenWhenItStillExistsInStorage() {

        SharedNoteRepository repository =
                mock(SharedNoteRepository.class);

        ShareNoteServiceImpl service =
                service(repository);

        SharedNote expired =
                SharedNote.builder()
                        .id(5L)
                        .hashId("abc123")
                        .videoId("yE6tIle64tU")
                        .videoTitle("Expired")
                        .noteContent("<p>Old</p>")
                        .cleaningStage(
                                CleaningStage.RAW_TRANSCRIPT
                        )
                        .createdAt(
                                Instant.now()
                                        .minus(
                                                2,
                                                ChronoUnit.DAYS
                                        )
                        )
                        .updatedAt(
                                Instant.now()
                        )
                        .expiresAt(
                                Instant.now()
                                        .minus(
                                                1,
                                                ChronoUnit.MINUTES
                                        )
                        )
                        .build();

        when(
                repository.findByHashId(
                        "abc123"
                )
        ).thenReturn(
                Optional.of(
                        expired
                )
        );

        assertThrows(
                ResourceNotFoundException.class,
                () ->
                        service.getNoteByHashId(
                                "abc123"
                        )
        );
    }

    @Test
    void stripsStoredXssBypassesWhilePreservingRichNoteMarkup() {

        InputSanitizer sanitizer =
                new InputSanitizer();

        String sanitized =
                sanitizer.sanitizeRichHtml(
                        "<h2>Safe heading</h2>"
                                + "<img src=x onerror=alert(1)>"
                                + "<a href=&#x6a;avascript:alert(1)>unsafe</a>"
                                + "<svg><a xlink:href=\"javascript:alert(1)\">svg</a></svg>"
                                + "<p style=\"background:url(javascript:alert(1))\">Safe text</p>"
                );

        assertTrue(
                sanitized.contains(
                        "<h2>Safe heading</h2>"
                )
        );

        assertTrue(
                sanitized.contains(
                        "Safe text"
                )
        );

        assertFalse(
                sanitized
                        .toLowerCase()
                        .contains(
                                "onerror"
                        )
        );

        assertFalse(
                sanitized
                        .toLowerCase()
                        .contains(
                                "javascript:"
                        )
        );

        assertFalse(
                sanitized
                        .toLowerCase()
                        .contains(
                                "<svg"
                        )
        );

        assertFalse(
                sanitized
                        .toLowerCase()
                        .contains(
                                "style="
                        )
        );
    }

    @Test
    void sanitizesLegacySnapshotAgainWhenItIsRead() {

        SharedNoteRepository repository =
                mock(SharedNoteRepository.class);

        ShareNoteServiceImpl service =
                service(repository);

        SharedNote legacy =
                SharedNote.builder()
                        .hashId("legacy1")
                        .videoId("yE6tIle64tU")
                        .videoTitle("Legacy")
                        .noteContent(
                                "<img src=x onerror=alert(1)>"
                                        + "<p>Safe</p>"
                        )
                        .cleaningStage(
                                CleaningStage.RAW_TRANSCRIPT
                        )
                        .createdAt(
                                Instant.now()
                        )
                        .updatedAt(
                                Instant.now()
                        )
                        .expiresAt(
                                Instant.now()
                                        .plus(
                                                1,
                                                ChronoUnit.DAYS
                                        )
                        )
                        .build();

        when(
                repository.findByHashId(
                        "legacy1"
                )
        ).thenReturn(
                Optional.of(
                        legacy
                )
        );

        SharedNoteResponse response =
                service.getNoteByHashId(
                        "legacy1"
                );

        assertTrue(
                response.noteContent()
                        .contains(
                                "Safe"
                        )
        );

        assertFalse(
                response.noteContent()
                        .toLowerCase()
                        .contains(
                                "onerror"
                        )
        );
    }

    private ShareNoteServiceImpl service(
            SharedNoteRepository repository
    ) {

        ShareNoteServiceImpl service =
                new ShareNoteServiceImpl(
                        repository,
                        new InputSanitizer()
                );

        ReflectionTestUtils.setField(
                service,
                "defaultTtlHours",
                24L
        );

        ReflectionTestUtils.setField(
                service,
                "publicBaseUrl",
                "http://localhost:5173/"
        );

        return service;
    }
}