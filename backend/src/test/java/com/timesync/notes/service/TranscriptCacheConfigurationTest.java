package com.timesync.notes.service;

import com.timesync.notes.dto.request.ExtractPlaylistRequest;
import com.timesync.notes.service.impl.PlaylistExtractionServiceImpl;
import com.timesync.notes.integration.youtube.YoutubeTranscriptCache;
import org.junit.jupiter.api.Test;
import org.springframework.cache.annotation.Cacheable;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TranscriptCacheConfigurationTest {

    @Test
    void metadataResponsesAreExcludedWithoutChangingSuccessfulTranscriptCacheKey() throws NoSuchMethodException {
        Method method = YoutubeTranscriptCache.class.getMethod(
                "getOrExtract",
                String.class, java.util.function.Supplier.class
        );

        Cacheable cacheable = method.getAnnotation(Cacheable.class);

        assertNotNull(cacheable);
        assertFalse(cacheable.sync());
        assertEquals("#result == null || #result.noteSource() == T(com.timesync.notes.entity.NoteSource).METADATA || #result.chapterAvailability() == T(com.timesync.notes.entity.ChapterAvailability).TEMPORARILY_UNAVAILABLE", cacheable.unless());
        assertEquals("'v9:' + #videoId", cacheable.key());
        assertEquals("", cacheable.condition());
    }

    @Test
    void playlistCacheExcludesTemporaryChapterFailures() throws NoSuchMethodException {
        Method method = PlaylistExtractionServiceImpl.class.getMethod(
                "extractPlaylist",
                ExtractPlaylistRequest.class
        );

        Cacheable cacheable = method.getAnnotation(Cacheable.class);

        assertNotNull(cacheable);
        assertFalse(cacheable.sync());
        assertTrue(cacheable.unless().contains("TEMPORARILY_UNAVAILABLE"));
        assertEquals("", cacheable.condition());
    }
}
