package com.timesync.notes.service;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.timesync.notes.util.TranscriptChunker;
import java.util.ArrayList;
import java.util.List;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TranscriptChunkServiceTest {
    private final ConcurrentMapCacheManager manager = new ConcurrentMapCacheManager(TranscriptChunkService.CACHE_NAME);
    private final TranscriptChunkService service = new TranscriptChunkService(manager);

    @Test void createsOnceAndReusesExactOrderedChunksWithTrimNormalization() {
        String source = "a".repeat(24000) + "b".repeat(24000) + "c";
        try (var chunker = mockStatic(TranscriptChunker.class, CALLS_REAL_METHODS)) {
            var first = service.getOrCreate(" \n" + source + "\t ");
            assertEquals(List.of("a".repeat(24000), "b".repeat(24000), "c"), first.chunks());
            assertSame(first, service.getOrCreate(source));
            chunker.verify(() -> TranscriptChunker.chunkTranscript(source), times(1));
            assertThrows(UnsupportedOperationException.class, () -> first.chunks().add("change"));
        }
    }

    @Test void changedSourceGetsNewIdentityRegardlessOfVideoAndOldEntryRemains() {
        var a = service.getOrCreate("source A");
        var b = service.getOrCreate("source B");
        assertNotEquals(a.transcriptHash(), b.transcriptHash());
        assertEquals(List.of("source B"), b.chunks());
        assertSame(a, service.getOrCreate("source A"));
        assertSame(b, service.getOrCreate("source B"));
        // Video, job, model and language are deliberately absent from cache identity.
        assertEquals(64, a.transcriptHash().length());
    }

    @Test void missingExpiredEntryIsRecreatedAndWrongVersionOrTypeIsIgnored() {
        var first = service.getOrCreate("source");
        Cache cache = manager.getCache(TranscriptChunkService.CACHE_NAME);
        String key = "v1:" + first.transcriptHash();
        cache.evict(key); // Simulates Redis returning a miss after expiration.
        var recreated = service.getOrCreate("source");
        assertNotSame(first, recreated);
        assertEquals(first.chunks(), recreated.chunks());
        cache.put(key, new TranscriptChunkSet(first.transcriptHash(), "old", List.of("wrong"), Instant.now()));
        assertEquals(List.of("source"), service.getOrCreate("source").chunks());
        cache.put(key, "invalid serialized artifact");
        assertEquals(List.of("source"), service.getOrCreate("source").chunks());
    }

    @Test void nullAndBlankRemainEmptyAndListsAreDefensivelyCopied() {
        assertSame(service.getOrCreate(null), service.getOrCreate(" \n\t"));
        assertTrue(service.getOrCreate(null).chunks().isEmpty());
        var mutable = new ArrayList<>(List.of("original"));
        var set = new TranscriptChunkSet("hash", "v1", mutable, Instant.now());
        mutable.set(0, "changed");
        assertEquals(List.of("original"), set.chunks());
    }

    @Test void readAndWriteFailuresAreSafeAndDoNotBreakChunking() {
        CacheManager brokenManager = mock(CacheManager.class);
        Cache broken = mock(Cache.class);
        when(brokenManager.getCache(anyString())).thenReturn(broken);
        when(broken.get(anyString(), eq(Object.class))).thenThrow(new IllegalStateException("PRIVATE_SOURCE https://secret"));
        doThrow(new IllegalStateException("PRIVATE_SOURCE")).when(broken).put(any(), any());
        Logger logger = (Logger) LoggerFactory.getLogger(TranscriptChunkService.class);
        Level previous = logger.getLevel();
        var appender = new ListAppender<ILoggingEvent>();
        appender.start(); logger.addAppender(appender); logger.setLevel(Level.DEBUG);
        try {
            assertEquals(List.of("PRIVATE_SOURCE"), new TranscriptChunkService(brokenManager).getOrCreate("PRIVATE_SOURCE").chunks());
            service.getOrCreate("PRIVATE_SOURCE");
            service.getOrCreate("PRIVATE_SOURCE");
            assertTrue(appender.list.stream().anyMatch(e -> e.getFormattedMessage().contains("cache hit")));
            assertTrue(appender.list.stream().noneMatch(e -> e.getFormattedMessage().contains("PRIVATE_SOURCE")
                    || e.getFormattedMessage().contains("https://") || e.getThrowableProxy() != null));
        } finally { logger.detachAppender(appender); logger.setLevel(previous); appender.stop(); }
    }

    @Test void missingCacheAndManagerFailureStillProduceChunks() {
        CacheManager unavailable = mock(CacheManager.class);
        assertEquals(List.of("source"), new TranscriptChunkService(unavailable).getOrCreate("source").chunks());
        when(unavailable.getCache(anyString())).thenThrow(new IllegalStateException("offline"));
        assertEquals(List.of("source"), new TranscriptChunkService(unavailable).getOrCreate("source").chunks());
    }
}
