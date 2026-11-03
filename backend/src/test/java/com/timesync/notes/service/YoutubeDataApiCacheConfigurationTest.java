package com.timesync.notes.service;

import com.timesync.notes.service.impl.YoutubeDataApiService;
import org.junit.jupiter.api.Test;
import org.springframework.cache.annotation.Cacheable;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;

class YoutubeDataApiCacheConfigurationTest {

    @Test
    void videoMetadataUsesVersionedCacheKey() throws NoSuchMethodException {
        Method method = YoutubeDataApiService.class.getMethod("getVideoMetadata", String.class);
        Cacheable cacheable = method.getAnnotation(Cacheable.class);

        assertEquals("'v2:' + #videoId", cacheable.key());
    }

    @Test
    void playlistCollectionUsesVersionedCacheKey() throws NoSuchMethodException {
        Method method = YoutubeDataApiService.class.getMethod("getPlaylistVideoIds", String.class);
        Cacheable cacheable = method.getAnnotation(Cacheable.class);

        assertEquals("'v2:' + #playlistId", cacheable.key());
    }
}
