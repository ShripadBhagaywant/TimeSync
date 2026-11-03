package com.timesync.notes.dto.response;

import java.util.List;

public record CleanedNoteResponse(
        String cleanedNotes,
        List<ChapterDto> chapters
) {}
