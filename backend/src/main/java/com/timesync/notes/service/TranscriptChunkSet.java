package com.timesync.notes.service;

import java.io.Serializable;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Internal disposable source artifact; never contains generated notes or model state. */
public record TranscriptChunkSet(String transcriptHash, String chunkingVersion,
        List<String> chunks, Instant createdAt) implements Serializable {
    public TranscriptChunkSet {
        Objects.requireNonNull(transcriptHash);
        Objects.requireNonNull(chunkingVersion);
        Objects.requireNonNull(createdAt);
        chunks = List.copyOf(chunks);
    }
}
