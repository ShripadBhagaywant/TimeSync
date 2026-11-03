package com.timesync.notes.dto.response;

import com.timesync.notes.entity.CleaningStage;
import lombok.Builder;

import java.time.Instant;

@Builder
public record SharedNoteResponse(
        String hashId,
        String shareUrl,
        String videoId,
        String videoTitle,
        String noteContent,
        CleaningStage cleaningStage,
        Instant createdAt,
        Instant expiresAt
) {
}
