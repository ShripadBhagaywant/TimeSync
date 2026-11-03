package com.timesync.notes.integration.youtube;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.test.context.support.TestPropertySourceUtils;

import static com.timesync.notes.integration.youtube.YoutubeAvailabilityScope.*;
import static org.junit.jupiter.api.Assertions.*;

class YoutubeResilienceConfigurationTest {
    @Test void defaultsWorkWithoutYamlAdditions() {
        try (var context = context()) {
            var guard = context.getBean(YoutubeAvailabilityGuard.class);
            assertEquals(60, guard.recordRateLimit(DATA_API).getRetryAfterSeconds());
            assertEquals(60, guard.recordRateLimit(CAPTION).getRetryAfterSeconds());
            assertEquals(3, context.getBean(YoutubeConcurrencyLimiter.class).availablePermits());
        }
    }

    @Test void legacyEnvironmentRemainsFallback() {
        try (var context = context("YOUTUBE_INITIAL_COOLDOWN_SECONDS=17", "YOUTUBE_MAXIMUM_COOLDOWN_SECONDS=34")) {
            var guard = context.getBean(YoutubeAvailabilityGuard.class);
            assertEquals(17, guard.recordRateLimit(DATA_API).getRetryAfterSeconds());
            assertEquals(17, guard.recordRateLimit(CAPTION).getRetryAfterSeconds());
            assertEquals(34, guard.recordRateLimit(CAPTION).getRetryAfterSeconds());
        }
    }

    @Test void scopedEnvironmentOverridesLegacyProperties() {
        try (var context = context("app.youtube.availability.initial-cooldown-seconds=17",
                "app.youtube.availability.maximum-cooldown-seconds=34",
                "YOUTUBE_DATA_API_INITIAL_COOLDOWN_SECONDS=10", "YOUTUBE_DATA_API_MAXIMUM_COOLDOWN_SECONDS=20",
                "YOUTUBE_CONTENT_INITIAL_COOLDOWN_SECONDS=30", "YOUTUBE_CONTENT_MAXIMUM_COOLDOWN_SECONDS=60",
                "YOUTUBE_MAX_CONCURRENT_REQUESTS=2")) {
            var guard = context.getBean(YoutubeAvailabilityGuard.class);
            assertEquals(10, guard.recordRateLimit(DATA_API).getRetryAfterSeconds());
            assertEquals(30, guard.recordRateLimit(CAPTION).getRetryAfterSeconds());
            assertEquals(2, context.getBean(YoutubeConcurrencyLimiter.class).availablePermits());
        }
    }

    private AnnotationConfigApplicationContext context(String... properties) {
        var context = new AnnotationConfigApplicationContext();
        TestPropertySourceUtils.addInlinedPropertiesToEnvironment(context, properties);
        context.register(YoutubeAvailabilityGuard.class, YoutubeConcurrencyLimiter.class);
        context.refresh();
        return context;
    }
}