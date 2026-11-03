package com.timesync.notes.guardrail;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.function.LongSupplier;

/** Process-local reuse of successful verification; stores hashes, never transcript text. */
final class VerifiedContentCache {
    private final LinkedHashMap<String, Entry> entries = new LinkedHashMap<>(16, 0.75f, true);
    private final int maximumSize;
    private final long ttlNanos;
    private final LongSupplier clock;

    VerifiedContentCache() {
        this(256, Duration.ofMinutes(10), System::nanoTime);
    }

    VerifiedContentCache(int maximumSize, Duration ttl, LongSupplier clock) {
        this.maximumSize = maximumSize;
        this.ttlNanos = ttl.toNanos();
        this.clock = clock;
    }

    synchronized ContentPolicyDecision get(String key) {
        Entry entry = entries.get(key);
        if (entry == null) return null;
        if (clock.getAsLong() - entry.createdAt() >= ttlNanos) {
            entries.remove(key);
            return null;
        }
        return entry.decision();
    }

    synchronized void put(String key, ContentPolicyDecision decision) {
        if (decision.verificationLevel() != VerificationLevel.SEMANTIC_VERIFIED
                || !decision.eligibility().isAllowed()) return;
        entries.put(key, new Entry(decision, clock.getAsLong()));
        while (entries.size() > maximumSize) entries.remove(entries.keySet().iterator().next());
    }

    static String key(String... fields) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String field : fields) {
                byte[] bytes = (field == null ? "" : field).getBytes(StandardCharsets.UTF_8);
                digest.update(ByteBuffer.allocate(4).putInt(bytes.length).array());
                digest.update(bytes);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private record Entry(ContentPolicyDecision decision, long createdAt) { }
}
