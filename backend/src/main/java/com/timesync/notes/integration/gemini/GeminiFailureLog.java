package com.timesync.notes.integration.gemini;

import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;

/** Logging-only copy: retain exception types and frames, never provider messages. */
public final class GeminiFailureLog {
    private GeminiFailureLog() {}

    /** Bounded cause inspection; never returns exception messages or provider data. */
    public static String causeType(Throwable failure) {
        Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        String type = "Unknown";
        for (int depth = 0; failure != null && depth < 16 && visited.add(failure); depth++) {
            type = failure.getClass().getSimpleName();
            failure = failure.getCause();
        }
        return type;
    }

    public static Throwable safeStackTrace(Throwable failure) {
        return copy(failure, Collections.newSetFromMap(new IdentityHashMap<>()), 0);
    }

    private static Throwable copy(Throwable failure, Set<Throwable> visited, int depth) {
        if (failure == null || depth >= 8 || !visited.add(failure)) return null;
        Throwable safe = new Throwable(failure.getClass().getName());
        safe.setStackTrace(failure.getStackTrace());
        safe.initCause(copy(failure.getCause(), visited, depth + 1));
        for (Throwable suppressed : failure.getSuppressed()) {
            Throwable safeSuppressed = copy(suppressed, visited, depth + 1);
            if (safeSuppressed != null) safe.addSuppressed(safeSuppressed);
        }
        return safe;
    }
}
