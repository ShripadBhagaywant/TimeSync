package com.timesync.notes.integration.youtube;

import com.timesync.notes.exception.UpstreamRateLimitException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.Objects;

/** Process-local, independent cooldowns; cache hits never reach the HTTP guard. */
@Slf4j
@Service
public class YoutubeAvailabilityGuard {
    private final EnumMap<YoutubeAvailabilityScope, State> states = new EnumMap<>(YoutubeAvailabilityScope.class);
    private final Clock clock;

    @Autowired
    public YoutubeAvailabilityGuard(
            @Value("${app.youtube.availability.data-api.initial-cooldown-seconds:${YOUTUBE_DATA_API_INITIAL_COOLDOWN_SECONDS:${app.youtube.availability.initial-cooldown-seconds:${YOUTUBE_INITIAL_COOLDOWN_SECONDS:60}}}}") long dataInitial,
            @Value("${app.youtube.availability.data-api.maximum-cooldown-seconds:${YOUTUBE_DATA_API_MAXIMUM_COOLDOWN_SECONDS:${app.youtube.availability.maximum-cooldown-seconds:${YOUTUBE_MAXIMUM_COOLDOWN_SECONDS:600}}}}") long dataMaximum,
            @Value("${app.youtube.availability.content.initial-cooldown-seconds:${YOUTUBE_CONTENT_INITIAL_COOLDOWN_SECONDS:${app.youtube.availability.initial-cooldown-seconds:${YOUTUBE_INITIAL_COOLDOWN_SECONDS:60}}}}") long contentInitial,
            @Value("${app.youtube.availability.content.maximum-cooldown-seconds:${YOUTUBE_CONTENT_MAXIMUM_COOLDOWN_SECONDS:${app.youtube.availability.maximum-cooldown-seconds:${YOUTUBE_MAXIMUM_COOLDOWN_SECONDS:600}}}}") long contentMaximum) {
        this(dataInitial, dataMaximum, contentInitial, contentMaximum, Clock.systemUTC());
    }

    public YoutubeAvailabilityGuard(long initial, long maximum) {
        this(initial, maximum, Clock.systemUTC());
    }

    public YoutubeAvailabilityGuard(long initial, long maximum, Clock clock) {
        this(initial, maximum, initial, maximum, clock);
    }

    public YoutubeAvailabilityGuard(long dataInitial, long dataMaximum, long contentInitial, long contentMaximum, Clock clock) {
        this.clock = Objects.requireNonNull(clock);
        states.put(YoutubeAvailabilityScope.DATA_API, new State(dataInitial, dataMaximum));
        states.put(YoutubeAvailabilityScope.WATCH_PAGE, new State(contentInitial, contentMaximum));
        states.put(YoutubeAvailabilityScope.CAPTION, new State(contentInitial, contentMaximum));
    }

    public void checkAllowed(YoutubeAvailabilityScope scope) {
        State state = states.get(scope);
        synchronized (state) {
            long retryAfter = remainingSeconds(state);
            if (retryAfter > 0) {
                log.info("YouTube {} request blocked by cooldown. Retry after {} seconds.", scope, retryAfter);
                throw new UpstreamRateLimitException("YouTube is temporarily limiting requests.", retryAfter);
            }
        }
    }

    /** Called once per real HTTP 429, never for locally rejected requests. */
    public UpstreamRateLimitException recordRateLimit(YoutubeAvailabilityScope scope) {
        return recordRateLimit(scope, null);
    }

    public UpstreamRateLimitException recordRateLimit(YoutubeAvailabilityScope scope, YoutubeContentOperation operation) {
        State state = states.get(scope);
        synchronized (state) {
            long cooldown = state.previous == 0 ? state.initial
                    : state.previous > state.maximum / 2 ? state.maximum
                    : Math.min(state.maximum, state.previous * 2);
            state.previous = cooldown;
            Instant next = clock.instant().plusSeconds(cooldown);
            if (next.isAfter(state.blockedUntil)) state.blockedUntil = next;
            long retryAfter = remainingSeconds(state);
            log.warn("YouTube {} rate limit detected. Opening cooldown for {} seconds.", scope, retryAfter);
            return new UpstreamRateLimitException("YouTube is temporarily limiting requests.", retryAfter, operation);
        }
    }

    public void recordSuccess(YoutubeAvailabilityScope scope) {
        State state = states.get(scope);
        synchronized (state) {
            // A request that was already in flight cannot clear another request's cooldown.
            if (!state.blockedUntil.isAfter(clock.instant())) state.previous = 0;
        }
    }

    public long getRetryAfterSeconds(YoutubeAvailabilityScope scope) {
        State state = states.get(scope);
        synchronized (state) { return remainingSeconds(state); }
    }

    // Compatibility for the caption facade and existing callers.
    public void checkAllowed() { checkAllowed(YoutubeAvailabilityScope.CAPTION); }
    public UpstreamRateLimitException recordRateLimit() { return recordRateLimit(YoutubeAvailabilityScope.CAPTION); }
    public void recordSuccess() { recordSuccess(YoutubeAvailabilityScope.CAPTION); }
    public long getRetryAfterSeconds() { return getRetryAfterSeconds(YoutubeAvailabilityScope.CAPTION); }

    private long remainingSeconds(State state) {
        Duration remaining = Duration.between(clock.instant(), state.blockedUntil);
        if (remaining.isNegative() || remaining.isZero()) return 0;
        return remaining.getSeconds() + (remaining.getNano() > 0 ? 1 : 0);
    }

    private static final class State {
        final long initial;
        final long maximum;
        Instant blockedUntil = Instant.EPOCH;
        long previous;
        State(long initial, long maximum) {
            if (initial <= 0 || maximum < initial) throw new IllegalArgumentException("YouTube cooldowns require 0 < initial <= maximum");
            this.initial = initial;
            this.maximum = maximum;
        }
    }
}