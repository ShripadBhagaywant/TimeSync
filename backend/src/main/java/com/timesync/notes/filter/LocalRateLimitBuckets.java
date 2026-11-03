package com.timesync.notes.filter;

import io.github.bucket4j.Bucket;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.LongSupplier;
import java.util.function.Supplier;

/** Bounded outage fallback. Saturation shares a bucket instead of resetting clients' limits. */
final class LocalRateLimitBuckets {
    private final Map<String, Entry> entries = new LinkedHashMap<>(16, 0.75f, true);
    private final int capacity;
    private final LongSupplier clock;
    private final Supplier<Bucket> factory;
    private final Bucket overflow;
    private static final long IDLE_NANOS = Duration.ofDays(1).toNanos();

    LocalRateLimitBuckets(int capacity, LongSupplier clock, Supplier<Bucket> factory) {
        this.capacity = capacity;
        this.clock = clock;
        this.factory = factory;
        this.overflow = factory.get();
    }

    synchronized Bucket get(String key) {
        long now = clock.getAsLong();
        var iterator = entries.entrySet().iterator();
        while (iterator.hasNext()) {
            if (now - iterator.next().getValue().lastAccess < IDLE_NANOS) break;
            iterator.remove();
        }
        Entry existing = entries.get(key);
        if (existing != null) {
            existing.lastAccess = now;
            return existing.bucket;
        }
        if (entries.size() >= capacity) return overflow;
        Bucket bucket = factory.get();
        entries.put(key, new Entry(bucket, now));
        return bucket;
    }

    private static final class Entry {
        final Bucket bucket;
        long lastAccess;
        Entry(Bucket bucket, long lastAccess) {
            this.bucket = bucket;
            this.lastAccess = lastAccess;
        }
    }
}
