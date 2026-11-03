package com.timesync.notes.dto.request;

import com.timesync.notes.entity.CleaningStage;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ShareNoteRequest(
        @NotBlank(message = "Video ID is required")
        @Pattern(regexp = "^[a-zA-Z0-9_-]{11}$", message = "Invalid YouTube video ID")
        String videoId,

        @NotBlank(message = "Video title is required")
        @Size(max = 500, message = "Video title must be 500 characters or less")
        String videoTitle,

        @NotBlank(message = "Note content is required")
        @Size(max = 2000000, message = "Note content exceeds the 2 MB snapshot limit")
        String noteContent,

        @NotNull(message = "Cleaning stage is required")
        CleaningStage cleaningStage
) {
}
