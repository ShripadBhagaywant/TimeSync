package com.timesync.notes.service;

import com.timesync.notes.dto.request.ShareNoteRequest;
import com.timesync.notes.entity.CleaningStage;
import com.timesync.notes.entity.SharedNote;
import com.timesync.notes.repository.SharedNoteRepository;
import com.timesync.notes.security.InputSanitizer;
import com.timesync.notes.service.impl.ShareNoteServiceImpl;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.util.ReflectionTestUtils;

import javax.sql.DataSource;
import java.sql.SQLException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:share_length;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.sql.init.mode=never"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ShareSnapshotPersistenceTest {
    private static final String TEMP_HASH = "TEMP_12345678-1234-1234-1234-123456789abc";
    @Autowired SharedNoteRepository repository;
    @Autowired EntityManager entityManager;
    @Autowired DataSource dataSource;
    @Autowired JdbcTemplate jdbc;

    private void script(String path) {
        new ResourceDatabasePopulator(new ClassPathResource(path)).execute(dataSource);
    }

    @Test void legacyColumnRejectsTemporaryHashAndMigrationPreservesItWithoutTruncation() {
        assertEquals(41, TEMP_HASH.length());
        jdbc.execute("ALTER TABLE shared_notes ALTER COLUMN hash_id TYPE VARCHAR(12)");
        var error = assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "INSERT INTO shared_notes (hash_id, video_id, video_title, note_content, cleaning_stage, created_at, updated_at) "
                        + "VALUES (?, 'abcdefghijk', 'Lesson', '<p>Notes</p>', 'METADATA_FALLBACK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                TEMP_HASH));
        assertEquals("22001", ((SQLException) error.getMostSpecificCause()).getSQLState());

        script("db/migration/V1__widen_shared_notes_hash_id.sql");
        script("db/migration/V1__widen_shared_notes_hash_id.sql");
        SharedNote saved = repository.saveAndFlush(SharedNote.builder()
                .hashId(TEMP_HASH).videoId("abcdefghijk").videoTitle("Lesson")
                .noteContent("<p>Notes</p>").cleaningStage(CleaningStage.METADATA_FALLBACK)
                .expiresAt(Instant.now().plus(24, ChronoUnit.HOURS)).build());
        entityManager.clear();
        SharedNote loaded = repository.findById(saved.getId()).orElseThrow();
        assertEquals(TEMP_HASH, loaded.getHashId());
        assertEquals("<p>Notes</p>", loaded.getNoteContent());
        assertEquals(CleaningStage.METADATA_FALLBACK, loaded.getCleaningStage());
        assertEquals(64, hashColumnLength());
    }

    @ParameterizedTest @EnumSource(CleaningStage.class)
    void migratedSnapshotsRoundTripForEveryRealPersistedEnum(CleaningStage stage) {
        jdbc.execute("ALTER TABLE shared_notes ALTER COLUMN hash_id TYPE VARCHAR(12)");
        script("db/migration/V1__widen_shared_notes_hash_id.sql");
        var service = new ShareNoteServiceImpl(repository, new InputSanitizer());
        ReflectionTestUtils.setField(service, "defaultTtlHours", 24L);
        ReflectionTestUtils.setField(service, "publicBaseUrl", "http://localhost:5173");
        Instant before = Instant.now();
        var created = service.createShareSnapshot(new ShareNoteRequest(
                "abcdefghijk", "Lesson", "<p>हिंदी notes 🙂</p>", stage));
        entityManager.clear();
        var read = service.getNoteByHashId(created.hashId());
        assertTrue(read.hashId().matches("[a-f0-9]{32}"));
        assertEquals(created.hashId(), read.hashId());
        assertEquals("http://localhost:5173/notes/" + created.hashId(), read.shareUrl());
        assertEquals("abcdefghijk", read.videoId());
        assertEquals("Lesson", read.videoTitle());
        assertEquals("<p>हिंदी notes 🙂</p>", read.noteContent());
        assertEquals(stage, read.cleaningStage());
        assertNotNull(read.createdAt());
        assertTrue(read.expiresAt().isAfter(before.plus(24, ChronoUnit.HOURS).minusSeconds(1)));
        assertTrue(read.expiresAt().isBefore(Instant.now().plus(24, ChronoUnit.HOURS).plusSeconds(1)));
    }

    @Test void freshMappingAndStartupSqlAgreeOnHashLengthOnly() {
        assertEquals(64, hashColumnLength());
        jdbc.execute("ALTER TABLE shared_notes ALTER COLUMN hash_id TYPE VARCHAR(12)");
        script("schema.sql");
        script("schema.sql");
        assertEquals(64, hashColumnLength());
        assertEquals(30, jdbc.queryForObject("SELECT character_maximum_length FROM information_schema.columns "
                + "WHERE table_name='SHARED_NOTES' AND column_name='CLEANING_STAGE'", Integer.class));
    }

    private int hashColumnLength() {
        return jdbc.queryForObject("SELECT character_maximum_length FROM information_schema.columns "
                + "WHERE table_name='SHARED_NOTES' AND column_name='HASH_ID'", Integer.class);
    }
}
