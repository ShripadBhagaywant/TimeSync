package com.timesync.notes.entity;

public enum CleaningStage {

    RAW_TRANSCRIPT,
    REGEX_SANITIZED,
    GEMINI_AI_REFINED,
    FALLBACK_REGEX,
    GEMINI_METADATA_GENERATED,
    METADATA_FALLBACK
}
