package com.timesync.notes.service;

import com.timesync.notes.util.TranscriptChunker;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class TranscriptChunkService {
    public static final String CACHE_NAME = "aiTranscriptChunks";
    // Bump when chunk size, splitting, overlap, or normalization changes.
    static final String CHUNKING_VERSION = "v1";
    private final CacheManager cacheManager;

    public TranscriptChunkService(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    public TranscriptChunkSet getOrCreate(String transcript) {
        String normalized = transcript == null ? "" : transcript.trim();
        String hash = fingerprint(normalized);
        String key = CHUNKING_VERSION + ":" + hash;
        Cache cache = null;
        try {
            cache = cacheManager == null ? null : cacheManager.getCache(CACHE_NAME);
            Object value = cache == null ? null : cache.get(key, Object.class);
            if (value instanceof TranscriptChunkSet set
                    && hash.equals(set.transcriptHash())
                    && CHUNKING_VERSION.equals(set.chunkingVersion())) {
                log.debug("AI transcript chunk cache hit. fingerprintPrefix={}, chunks={}",
                        hash.substring(0, 8), set.chunks().size());
                return set;
            }
        } catch (RuntimeException ex) {
            // Programmatic Cache calls bypass CacheErrorHandler. Preserve its fail-open
            // policy locally, without logging serializer messages that can contain text.
            log.warn("AI transcript chunk cache read failed; using live chunks. errorType={}",
                    ex.getClass().getSimpleName());
        }

        TranscriptChunkSet set = new TranscriptChunkSet(hash, CHUNKING_VERSION,
                TranscriptChunker.chunkTranscript(normalized), Instant.now());
        try {
            if (cache != null) cache.put(key, set);
        } catch (RuntimeException ex) {
            log.warn("AI transcript chunk cache write failed; using live chunks. errorType={}",
                    ex.getClass().getSimpleName());
        }
        log.debug("AI transcript chunk cache miss. fingerprintPrefix={}, chunks={}",
                hash.substring(0, 8), set.chunks().size());
        return set;
    }

    private static String fingerprint(String normalized) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(normalized.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is required by the Java runtime", ex);
        }
    }
}
