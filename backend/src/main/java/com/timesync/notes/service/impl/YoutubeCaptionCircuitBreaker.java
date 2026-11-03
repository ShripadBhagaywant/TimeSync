package com.timesync.notes.service.impl;

import com.timesync.notes.integration.youtube.YoutubeAvailabilityGuard;
import com.timesync.notes.integration.youtube.YoutubeAvailabilityScope;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Compatibility facade: caption availability uses the CAPTION cooldown. */
@Component
public class YoutubeCaptionCircuitBreaker {
    private final YoutubeAvailabilityGuard guard;

    @Autowired
    public YoutubeCaptionCircuitBreaker(YoutubeAvailabilityGuard guard) {
        this.guard = guard;
    }

    public YoutubeCaptionCircuitBreaker(long initial, long maximum) {
        this(new YoutubeAvailabilityGuard(initial, maximum));
    }

    public void checkAllowed() { guard.checkAllowed(YoutubeAvailabilityScope.CAPTION); }
    public void recordRateLimit() { guard.recordRateLimit(YoutubeAvailabilityScope.CAPTION); }
    public void recordSuccess() { guard.recordSuccess(YoutubeAvailabilityScope.CAPTION); }
}
