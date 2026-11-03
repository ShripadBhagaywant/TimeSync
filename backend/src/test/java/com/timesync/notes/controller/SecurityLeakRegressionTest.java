package com.timesync.notes.controller;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.timesync.notes.dto.response.SharedNoteResponse;
import com.timesync.notes.exception.GlobalExceptionHandler;
import com.timesync.notes.service.ShareNoteService;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DataAccessResourceFailureException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SecurityLeakRegressionTest {
    @Test
    void databaseFailuresDoNotLogDatabasePayloads() {
        Logger logger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
        var captured = new ListAppender<ILoggingEvent>();
        captured.start();
        logger.addAppender(captured);
        try {
            var handler = new GlobalExceptionHandler();
            var constraint = handler.handleStorageConstraint(new DataIntegrityViolationException("PRIVATE_NOTE_PAYLOAD"));
            var unavailable = handler.handleStorageUnavailable(new DataAccessResourceFailureException("PRIVATE_DATABASE_URL"));
            assertEquals(503, constraint.getStatusCode().value());
            assertEquals(503, unavailable.getStatusCode().value());
            assertFalse(captured.list.isEmpty());
            assertTrue(captured.list.stream().noneMatch(event -> event.getFormattedMessage().contains("PRIVATE_")));
        } finally {
            logger.detachAppender(captured);
            captured.stop();
        }
    }

    @Test
    void sharedNotesCannotBeRetainedByPublicCaches() {
        var service = mock(ShareNoteService.class);
        when(service.getNoteByHashId("legacy1")).thenReturn(mock(SharedNoteResponse.class));
        var response = new NoteShareController(service).getSharedNote("legacy1");
        assertEquals("no-store", response.getHeaders().getCacheControl());
        assertNull(response.getHeaders().getETag());
    }
}
