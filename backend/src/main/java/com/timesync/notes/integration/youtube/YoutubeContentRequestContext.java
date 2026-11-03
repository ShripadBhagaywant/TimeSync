package com.timesync.notes.integration.youtube;

import java.util.function.Supplier;

/** Synchronous request-local diagnostics; never transmitted as HTTP headers or used in cache keys. */
public record YoutubeContentRequestContext(YoutubeContentOperation operation, String videoId) {
    private static final ThreadLocal<YoutubeContentRequestContext> CURRENT = new ThreadLocal<>();

    public YoutubeContentRequestContext {
        videoId = videoId != null && videoId.matches("[a-zA-Z0-9_-]{11}") ? videoId : "unknown";
    }

    public static <T> T with(YoutubeContentOperation operation, String videoId, Supplier<T> request) {
        YoutubeContentRequestContext previous = CURRENT.get();
        CURRENT.set(new YoutubeContentRequestContext(operation, videoId));
        try {
            return request.get();
        } finally {
            if (previous == null) CURRENT.remove();
            else CURRENT.set(previous);
        }
    }

    static YoutubeContentRequestContext current() {
        YoutubeContentRequestContext context = CURRENT.get();
        return context == null ? new YoutubeContentRequestContext(null, null) : context;
    }
}