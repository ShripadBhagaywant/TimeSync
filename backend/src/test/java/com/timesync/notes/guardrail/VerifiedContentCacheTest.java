package com.timesync.notes.guardrail;

import com.timesync.notes.entity.ContentEligibility;
import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.*;

class VerifiedContentCacheTest {
    private final ContentPolicyDecision approved = ContentPolicyDecision.semantic(ContentEligibility.EDUCATIONAL);

    @Test
    void expiresWithoutExtendingLifetimeOnRead() {
        AtomicLong clock = new AtomicLong();
        var cache = new VerifiedContentCache(2, Duration.ofNanos(10), clock::get);
        cache.put("a", approved);
        clock.set(9);
        assertEquals(approved, cache.get("a"));
        clock.set(10);
        assertNull(cache.get("a"));
    }

    @Test
    void evictsLeastRecentlyUsedEntryAtCapacity() {
        var cache = new VerifiedContentCache(2, Duration.ofMinutes(1), System::nanoTime);
        cache.put("a", approved);
        cache.put("b", approved);
        assertNotNull(cache.get("a"));
        cache.put("c", approved);
        assertNull(cache.get("b"));
        assertNotNull(cache.get("a"));
        assertNotNull(cache.get("c"));
    }

    @Test
    void neverReusesRejectedOrUnverifiedDecisions() {
        var cache = new VerifiedContentCache();
        cache.put("rejected", ContentPolicyDecision.semantic(ContentEligibility.ENTERTAINMENT));
        cache.put("unknown", ContentPolicyDecision.semantic(ContentEligibility.UNKNOWN));
        cache.put("unverified", ContentPolicyDecision.unverified(ContentReasonCode.METADATA_INCONCLUSIVE));
        assertNull(cache.get("rejected"));
        assertNull(cache.get("unknown"));
        assertNull(cache.get("unverified"));
    }

    @Test
    void keysIncludeCompleteFieldsAndTheirBoundaries() {
        assertNotEquals(VerifiedContentCache.key("ab", "c"), VerifiedContentCache.key("a", "bc"));
        assertNotEquals(VerifiedContentCache.key("title", "transcript"), VerifiedContentCache.key("other", "transcript"));
        assertFalse(VerifiedContentCache.key("private transcript").contains("private"));
    }
}
