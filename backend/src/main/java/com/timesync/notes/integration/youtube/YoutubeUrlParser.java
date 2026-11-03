package com.timesync.notes.integration.youtube;

import com.timesync.notes.exception.YoutubeExtractionException;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

public final class YoutubeUrlParser {

    private static final Set<String> PATH_PREFIXES = Set.of("shorts", "embed", "live", "v");

    private YoutubeUrlParser() {
    }

    public static String extractVideoId(String input) {
        if (input == null || input.isBlank()) {
            throw invalid("Video URL or ID cannot be empty");
        }

        String trimmed = input.trim();
        if (isVideoId(trimmed)) {
            return trimmed;
        }

        URI uri = parseUri(trimmed);
        String host = Optional.ofNullable(uri.getHost()).orElse("").toLowerCase(Locale.ROOT);
        String path = Optional.ofNullable(uri.getPath()).orElse("");

        if ("youtu.be".equals(host) || host.endsWith(".youtu.be")) {
            return validateCandidate(firstPathSegment(path), input);
        }

        if (!isYoutubeHost(host)) {
            throw invalid("Only YouTube video URLs are supported");
        }

        String queryVideoId = queryParameter(uri.getRawQuery(), "v");
        if (isVideoId(queryVideoId)) {
            return queryVideoId;
        }

        String[] segments = Arrays.stream(path.split("/"))
                .filter(segment -> !segment.isBlank())
                .toArray(String[]::new);
        if (segments.length >= 2 && PATH_PREFIXES.contains(segments[0].toLowerCase(Locale.ROOT))) {
            return validateCandidate(segments[1], input);
        }

        throw invalid("Unable to extract a valid YouTube video ID from: " + input);
    }

    private static URI parseUri(String value) {
        try {
            return URI.create(value.matches("^[a-zA-Z][a-zA-Z0-9+.-]*://.*$")
                    ? value
                    : "https://" + value);
        } catch (IllegalArgumentException ex) {
            throw invalid("Invalid YouTube video URL");
        }
    }

    private static String queryParameter(String rawQuery, String name) {
        if (rawQuery == null || rawQuery.isBlank()) {
            return "";
        }
        for (String pair : rawQuery.split("&")) {
            String[] parts = pair.split("=", 2);
            if (URLDecoder.decode(parts[0], StandardCharsets.UTF_8).equalsIgnoreCase(name)) {
                return parts.length == 2
                        ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8)
                        : "";
            }
        }
        return "";
    }

    private static String firstPathSegment(String path) {
        return Arrays.stream(path.split("/"))
                .filter(segment -> !segment.isBlank())
                .findFirst()
                .orElse("");
    }

    private static boolean isYoutubeHost(String host) {
        return host.equals("youtube.com") ||
                host.endsWith(".youtube.com") ||
                host.equals("youtube-nocookie.com") ||
                host.endsWith(".youtube-nocookie.com");
    }

    private static String validateCandidate(String candidate, String originalInput) {
        String normalized = candidate == null ? "" : candidate.trim();
        if (isVideoId(normalized)) {
            return normalized;
        }
        throw invalid("Unable to extract a valid YouTube video ID from: " + originalInput);
    }

    private static boolean isVideoId(String candidate) {
        return candidate != null && candidate.matches("^[a-zA-Z0-9_-]{11}$");
    }

    private static YoutubeExtractionException invalid(String message) {
        return new YoutubeExtractionException(message);
    }
}
