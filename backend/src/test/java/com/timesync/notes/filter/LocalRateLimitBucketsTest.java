package com.timesync.notes.filter;

import io.github.bucket4j.Bucket;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class LocalRateLimitBucketsTest {
    private Bucket bucket() {
        return Bucket.builder().addLimit(limit -> limit.capacity(1)
                .refillGreedy(1, Duration.ofDays(1))).build();
    }

    @Test void saturationDoesNotResetExistingClientsAndSharesOverflowLimit() {
        var buckets = new LocalRateLimitBuckets(1, () -> 0, this::bucket);
        var first = buckets.get("first");
        assertTrue(first.tryConsume(1));
        assertTrue(buckets.get("second").tryConsume(1));
        assertFalse(buckets.get("third").tryConsume(1));
        assertSame(first, buckets.get("first"));
        assertFalse(first.tryConsume(1));
    }

    @Test void inactiveEntriesExpireOnlyAfterDailyRefillWindow() {
        var clock = new AtomicLong();
        var buckets = new LocalRateLimitBuckets(1, clock::get, this::bucket);
        var first = buckets.get("first");
        clock.set(Duration.ofHours(23).toNanos());
        assertSame(first, buckets.get("first"));
        clock.addAndGet(Duration.ofDays(1).toNanos());
        assertNotSame(first, buckets.get("first"));
    }
}
