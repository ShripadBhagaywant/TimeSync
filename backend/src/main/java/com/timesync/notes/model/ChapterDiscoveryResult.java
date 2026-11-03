package com.timesync.notes.model;
import com.timesync.notes.dto.response.ChapterDto;
import com.timesync.notes.entity.ChapterAvailability;
import java.util.List;
public record ChapterDiscoveryResult(List<ChapterDto> chapters, ChapterAvailability availability) {
    public ChapterDiscoveryResult { chapters = List.copyOf(chapters); }
    public static ChapterDiscoveryResult found(List<ChapterDto> chapters) {
        return new ChapterDiscoveryResult(chapters, chapters.isEmpty() ? ChapterAvailability.NONE : ChapterAvailability.AVAILABLE);
    }
    public static ChapterDiscoveryResult unavailable() {
        return new ChapterDiscoveryResult(List.of(), ChapterAvailability.TEMPORARILY_UNAVAILABLE);
    }
}
