package com.timesync.notes.integration.youtube;

import com.fasterxml.jackson.databind.JsonNode;
import com.timesync.notes.dto.response.ChapterDto;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class YoutubeChapterParser {

    private static final Pattern TIMESTAMP_FIRST = Pattern.compile(
            "^\\s*((?:\\d{1,2}:)?[0-5]?\\d:[0-5]\\d)\\s+[-–—|:]?\\s*(.+?)\\s*$"
    );
    private static final Pattern TITLE_FIRST = Pattern.compile(
            "^\\s*(.+?)\\s+[-–—|:]?\\s*((?:\\d{1,2}:)?[0-5]?\\d:[0-5]\\d)\\s*$"
    );

    private YoutubeChapterParser() {
    }

    public static List<ChapterDto> fromDescription(String description) {
        if (description == null || description.isBlank()) {
            return List.of();
        }

        List<ChapterDto> chapters = new ArrayList<>();
        for (String line : description.split("\\R")) {
            Matcher timestampFirst = TIMESTAMP_FIRST.matcher(line);
            Matcher titleFirst = TITLE_FIRST.matcher(line);
            if (timestampFirst.matches()) {
                addChapter(chapters, timestampFirst.group(2), timestampFirst.group(1));
            } else if (titleFirst.matches()) {
                addChapter(chapters, titleFirst.group(1), titleFirst.group(2));
            }
        }
        return normalize(chapters);
    }

    public static List<ChapterDto> fromPlayerResponse(JsonNode playerResponse) {
        if (playerResponse == null || playerResponse.isMissingNode()) {
            return List.of();
        }
        List<ChapterDto> chapters = new ArrayList<>();
        collectMarkers(playerResponse, chapters);
        return normalize(chapters);
    }

    private static void collectMarkers(JsonNode node, List<ChapterDto> chapters) {
        if (node == null || node.isValueNode()) {
            return;
        }

        JsonNode marker = node.path("macroMarkersListItemRenderer");
        if (!marker.isMissingNode()) {
            String title = readText(marker.path("title"));
            String formatted = readText(marker.path("timeDescription"));
            JsonNode secondsNode = marker.findValue("startTimeSeconds");
            long seconds = secondsNode == null ? parseTimestamp(formatted) : secondsNode.asLong(-1);
            if (!title.isBlank() && seconds >= 0) {
                chapters.add(new ChapterDto(title, seconds, formatted.isBlank() ? formatTimestamp(seconds) : formatted));
            }
        }

        node.elements().forEachRemaining(child -> collectMarkers(child, chapters));
    }

    private static void addChapter(List<ChapterDto> chapters, String title, String formatted) {
        long seconds = parseTimestamp(formatted);
        String normalizedTitle = title == null ? "" : title.trim();
        if (seconds >= 0 && !normalizedTitle.isBlank()) {
            chapters.add(new ChapterDto(normalizedTitle, seconds, formatTimestamp(seconds)));
        }
    }

    public static List<ChapterDto> normalize(List<ChapterDto> chapters) {
        Map<Long, ChapterDto> uniqueBySecond = new LinkedHashMap<>();
        chapters.stream()
                .sorted(Comparator.comparingLong(ChapterDto::startTimestampSeconds))
                .forEach(chapter -> uniqueBySecond.merge(chapter.startTimestampSeconds(), chapter, (first, second) -> second.title().trim().length() > first.title().trim().length() ? second : first));
        return List.copyOf(uniqueBySecond.values());
    }

    private static long parseTimestamp(String value) {
        if (value == null || value.isBlank()) {
            return -1;
        }
        String[] parts = value.trim().split(":");
        try {
            if (parts.length == 2) {
                return Long.parseLong(parts[0]) * 60 + Long.parseLong(parts[1]);
            }
            if (parts.length == 3) {
                return Long.parseLong(parts[0]) * 3600
                        + Long.parseLong(parts[1]) * 60
                        + Long.parseLong(parts[2]);
            }
        } catch (NumberFormatException ignored) {
            return -1;
        }
        return -1;
    }

    private static String formatTimestamp(long seconds) {
        long hours = seconds / 3600;
        long minutes = (seconds % 3600) / 60;
        long remainder = seconds % 60;
        return hours > 0
                ? "%02d:%02d:%02d".formatted(hours, minutes, remainder)
                : "%02d:%02d".formatted(minutes, remainder);
    }

    private static String readText(JsonNode textNode) {
        String simpleText = textNode.path("simpleText").asText("").trim();
        if (!simpleText.isBlank()) {
            return simpleText;
        }
        StringBuilder value = new StringBuilder();
        JsonNode runs = textNode.path("runs");
        if (runs.isArray()) {
            for (JsonNode run : runs) {
                value.append(run.path("text").asText(""));
            }
        }
        return value.toString().trim();
    }
}
