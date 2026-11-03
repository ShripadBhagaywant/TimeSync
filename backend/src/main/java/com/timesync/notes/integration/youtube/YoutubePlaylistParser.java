package com.timesync.notes.integration.youtube;

import com.timesync.notes.exception.UnprocessableVideoException;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;

public final class YoutubePlaylistParser {

    private YoutubePlaylistParser() {
    }

    public static String extractPlaylistId(String input) {
        if (input == null || input.isBlank()) {
            throw invalid("Playlist URL or ID cannot be empty.");
        }

        String trimmed = input.trim();
        if (isPlaylistId(trimmed)) {
            return trimmed;
        }

        URI uri = parseUri(trimmed);
        String host = Optional.ofNullable(uri.getHost()).orElse("").toLowerCase(Locale.ROOT);
        if (!isYoutubeHost(host)) {
            throw invalid("Only YouTube playlist URLs are supported.");
        }

        String playlistId = queryParameter(uri.getRawQuery(), "list");
        if (isPlaylistId(playlistId)) {
            return playlistId;
        }

        throw invalid("Invalid YouTube Playlist URL or ID format: " + input);
    }

    private static URI parseUri(String value) {
        try {
            return URI.create(value.matches("^[a-zA-Z][a-zA-Z0-9+.-]*://.*$")
                    ? value
                    : "https://" + value);
        } catch (IllegalArgumentException ex) {
            throw invalid("Invalid YouTube playlist URL.");
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

    private static boolean isYoutubeHost(String host) {
        return host.equals("youtube.com") || host.endsWith(".youtube.com");
    }

    private static boolean isPlaylistId(String candidate) {
        return candidate != null && candidate.matches("^[a-zA-Z0-9_-]{12,100}$");
    }

    private static UnprocessableVideoException invalid(String message) {
        return new UnprocessableVideoException(message, "INVALID_PLAYLIST_ID");
    }
}
