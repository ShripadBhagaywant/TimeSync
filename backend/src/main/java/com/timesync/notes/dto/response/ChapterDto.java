package com.timesync.notes.dto.response;

public record ChapterDto(
        String title,
        long startTimestampSeconds,
        String formattedTimestamp
) {}