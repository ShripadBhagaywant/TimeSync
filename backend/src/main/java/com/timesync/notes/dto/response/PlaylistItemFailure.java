package com.timesync.notes.dto.response;

public record PlaylistItemFailure(
        String videoId,
        String code,
        String message
) {
}
