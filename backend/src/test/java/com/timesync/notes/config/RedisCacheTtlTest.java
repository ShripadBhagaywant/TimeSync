package com.timesync.notes.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.cache.RedisCache;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import java.time.Duration;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class RedisCacheTtlTest {
    @Test void cacheRejectsUnexpectedRuntimeTypes() {
        var manager = new RedisConfig().cacheManager(mock(RedisConnectionFactory.class), new ObjectMapper(), 604800, 10800, 7200);
        manager.afterPropertiesSet();
        var pair = ((RedisCache) manager.getCache("transcriptNotes")).getCacheConfiguration().getValueSerializationPair();
        var bytes = pair.write(new java.io.File("not-a-cache-value"));
        assertThrows(org.springframework.data.redis.serializer.SerializationException.class, () -> pair.read(bytes));
    }

    @Test void videoMetadataStillRoundTripsWithRestrictedTypes() {
        var manager = new RedisConfig().cacheManager(mock(RedisConnectionFactory.class), new ObjectMapper(), 604800, 10800, 7200);
        manager.afterPropertiesSet();
        var pair = ((RedisCache) manager.getCache("youtubeVideoMetadata")).getCacheConfiguration().getValueSerializationPair();
        var metadata = new com.timesync.notes.service.impl.YoutubeDataApiService.VideoMetadata("Lesson", "Teacher", "PT1M", "27", "Description", java.util.List.of("learning"));
        assertEquals(metadata, pair.read(pair.write(metadata)));
    }
    @Test void transcriptIsSevenDaysPlayerThreeHoursAndOtherCachesStayOneDay() {
        var manager = new RedisConfig().cacheManager(mock(RedisConnectionFactory.class), new ObjectMapper(), 604800, 10800, 7200);
        manager.afterPropertiesSet();
        assertEquals(Duration.ofHours(2), ((RedisCache) manager.getCache("aiTranscriptChunks")).getCacheConfiguration().getTtl());
        assertEquals(Set.of("transcriptNotes", "youtubePlayerResponses", "aiTranscriptChunks"), Set.copyOf(manager.getCacheNames()));
        assertEquals(Duration.ofDays(7), ((RedisCache) manager.getCache("transcriptNotes")).getCacheConfiguration().getTtl());
        assertEquals(Duration.ofHours(3), ((RedisCache) manager.getCache("youtubePlayerResponses")).getCacheConfiguration().getTtl());
        for (String name : new String[]{"youtubeVideoMetadata", "youtubePlaylistMetadata", "youtubePlaylistVideoIds", "playlistNotes", "other"}) {
            var config = ((RedisCache) manager.getCache(name)).getCacheConfiguration();
            assertEquals(Duration.ofHours(24), config.getTtl());
            assertFalse(config.getAllowCacheNullValues());
        }
    }

    @Test void customTtlsAndValidation() {
        var config = new RedisConfig();
        var factory = mock(RedisConnectionFactory.class);
        var manager = config.cacheManager(factory, new ObjectMapper(), 1209600, 3600, 90);
        manager.afterPropertiesSet();
        assertEquals(Duration.ofSeconds(90), ((RedisCache) manager.getCache("aiTranscriptChunks")).getCacheConfiguration().getTtl());
        assertThrows(IllegalArgumentException.class, () -> config.cacheManager(factory, new ObjectMapper(), 604800, 10800, 0));
        assertEquals(Duration.ofDays(14), ((RedisCache) manager.getCache("transcriptNotes")).getCacheConfiguration().getTtl());
        assertEquals(Duration.ofHours(1), ((RedisCache) manager.getCache("youtubePlayerResponses")).getCacheConfiguration().getTtl());
        assertThrows(IllegalArgumentException.class, () -> config.cacheManager(factory, new ObjectMapper(), 0, 3600, 7200));
        assertThrows(IllegalArgumentException.class, () -> config.cacheManager(factory, new ObjectMapper(), 604800, -1, 7200));
    }
    @Test void chunkSetRoundTripsThroughActualRedisSerializer() {
        var manager = new RedisConfig().cacheManager(mock(RedisConnectionFactory.class), new ObjectMapper(), 604800, 10800, 7200);
        manager.afterPropertiesSet();
        var pair = ((RedisCache) manager.getCache("aiTranscriptChunks")).getCacheConfiguration().getValueSerializationPair();
        var set = new com.timesync.notes.service.TranscriptChunkSet("hash", "v1", java.util.List.of("first", "second"), java.time.Instant.now());
        var restored = (com.timesync.notes.service.TranscriptChunkSet) pair.read(pair.write(set));
        assertEquals(set, restored);
        assertThrows(UnsupportedOperationException.class, () -> restored.chunks().add("change"));
    }
}
