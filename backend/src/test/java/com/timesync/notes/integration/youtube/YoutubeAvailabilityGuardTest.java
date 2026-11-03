package com.timesync.notes.integration.youtube;

import com.timesync.notes.exception.UpstreamRateLimitException;
import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class YoutubeAvailabilityGuardTest {
    private final Clock clock = mock(Clock.class);
    private final Instant start = Instant.parse("2026-09-08T00:00:00Z");

    private YoutubeAvailabilityGuard guard() {
        when(clock.instant()).thenReturn(start);
        return new YoutubeAvailabilityGuard(60, 150, clock);
    }

    @Test void allowsWithoutCooldown() { assertDoesNotThrow(() -> guard().checkAllowed()); }

    @Test void blocksWithPositiveDynamicRetryAndRoundsUp() {
        var guard = guard();
        assertEquals(60, guard.recordRateLimit().getRetryAfterSeconds());
        when(clock.instant()).thenReturn(start.plusMillis(13200));
        assertEquals(47, assertThrows(UpstreamRateLimitException.class, guard::checkAllowed).getRetryAfterSeconds());
    }

    @Test void repeatedRateLimitsIncreaseAndStayBounded() {
        var guard = guard();
        assertEquals(60, guard.recordRateLimit().getRetryAfterSeconds());
        assertEquals(120, guard.recordRateLimit().getRetryAfterSeconds());
        for (int i = 0; i < 100; i++) assertEquals(150, guard.recordRateLimit().getRetryAfterSeconds());
    }

    @Test void expiryAllowsRequestsAndSuccessfulProbeResetsBackoff() {
        var guard = guard();
        guard.recordRateLimit();
        when(clock.instant()).thenReturn(start.plusSeconds(60));
        assertDoesNotThrow(() -> guard.checkAllowed());
        guard.recordSuccess();
        assertEquals(60, guard.recordRateLimit().getRetryAfterSeconds());
    }

    @Test void failedProbeAfterExpiryIncreasesBackoff() {
        var guard = guard();
        guard.recordRateLimit();
        when(clock.instant()).thenReturn(start.plusSeconds(60));
        assertEquals(120, guard.recordRateLimit().getRetryAfterSeconds());
    }

    @Test void concurrentSuccessCannotClearActiveCooldown() {
        var guard = guard();
        guard.checkAllowed(); // A request starts before another receives 429.
        guard.recordRateLimit();
        CompletableFuture.runAsync(guard::recordSuccess).join();
        assertEquals(60, assertThrows(UpstreamRateLimitException.class, guard::checkAllowed).getRetryAfterSeconds());
        assertEquals(120, guard.recordRateLimit().getRetryAfterSeconds());
    }

    @Test void invalidConfigurationFailsFast() {
        assertThrows(IllegalArgumentException.class, () -> new YoutubeAvailabilityGuard(0, 60));
        assertThrows(IllegalArgumentException.class, () -> new YoutubeAvailabilityGuard(60, 30));
    }
    @Test void scopesHaveIndependentConfigurationAndSuccess() {
        when(clock.instant()).thenReturn(start);
        var guard = new YoutubeAvailabilityGuard(10, 20, 60, 150, clock);
        assertEquals(60, guard.recordRateLimit(YoutubeAvailabilityScope.CAPTION).getRetryAfterSeconds());
        assertDoesNotThrow(() -> guard.checkAllowed(YoutubeAvailabilityScope.DATA_API));
        guard.recordSuccess(YoutubeAvailabilityScope.DATA_API);
        assertEquals(60, guard.getRetryAfterSeconds(YoutubeAvailabilityScope.CAPTION));
        assertEquals(10, guard.recordRateLimit(YoutubeAvailabilityScope.DATA_API).getRetryAfterSeconds());
        when(clock.instant()).thenReturn(start.plusSeconds(10));
        guard.recordSuccess(YoutubeAvailabilityScope.CAPTION);
        assertEquals(20, guard.recordRateLimit(YoutubeAvailabilityScope.DATA_API).getRetryAfterSeconds());
        assertEquals(50, guard.getRetryAfterSeconds(YoutubeAvailabilityScope.CAPTION));
    }

    @Test void dataCooldownLeavesContentAllowed() {
        var guard = guard();
        guard.recordRateLimit(YoutubeAvailabilityScope.DATA_API);
        assertDoesNotThrow(() -> guard.checkAllowed());
        guard.recordSuccess();
        assertEquals(60, guard.getRetryAfterSeconds(YoutubeAvailabilityScope.DATA_API));
    }    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(YoutubeAvailabilityScope.class)
    void allThreeScopesHaveIndependentCooldowns(YoutubeAvailabilityScope blocked) {
        var guard = guard();
        guard.recordRateLimit(blocked);
        for (var scope : YoutubeAvailabilityScope.values()) {
            if (scope == blocked) continue;
            assertDoesNotThrow(() -> guard.checkAllowed(scope));
            guard.recordSuccess(scope);
        }
        assertEquals(60, guard.getRetryAfterSeconds(blocked));
        when(clock.instant()).thenReturn(start.plusSeconds(60));
        assertEquals(120, guard.recordRateLimit(blocked).getRetryAfterSeconds());
    }}
