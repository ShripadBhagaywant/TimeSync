package com.timesync.notes.integration.youtube;

import com.timesync.notes.dto.response.TranscriptResponse;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.function.Supplier;

/** Separate proxy boundary ensures the cache write completes before the flight completes. */
@Service
public class YoutubeTranscriptCache {
    // Caption absence may change. Keep metadata workspaces out of the successful transcript cache.
    @Cacheable(value = "transcriptNotes", key = "'v9:' + #videoId",
            unless = "#result == null || #result.noteSource() == T(com.timesync.notes.entity.NoteSource).METADATA || #result.chapterAvailability() == T(com.timesync.notes.entity.ChapterAvailability).TEMPORARILY_UNAVAILABLE")
    public TranscriptResponse getOrExtract(String videoId, Supplier<TranscriptResponse> extraction) {
        return extraction.get();
    }
}
