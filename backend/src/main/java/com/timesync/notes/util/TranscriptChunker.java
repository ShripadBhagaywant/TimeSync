package com.timesync.notes.util;

import java.util.ArrayList;
import java.util.List;

public final class TranscriptChunker {

    /*
     * Approximately 8k tokens using the project's conservative
     * estimate of roughly 3 characters per token.
     */
    private static final int DEFAULT_CHUNK_SIZE = 24_000;

    /*
     * 6 chunks × 24,000 chars gives an upper bound of roughly
     * 144,000 characters while keeping individual requests manageable.
     *
     * The AiNoteJobService daily budget still provides the outer
     * application-level quota protection.
     */
    private static final int MAX_AI_CHUNKS = 6;

    /*
     * Don't split extremely early just because a punctuation character
     * happens to appear near the beginning of the search window.
     */
    private static final double MIN_SPLIT_RATIO = 0.70;

    private TranscriptChunker() {
    }

    public static List<String> chunkTranscript(
            String transcript) {

        if (transcript == null
                || transcript.isBlank()) {

            return List.of();
        }

        String normalized = transcript.trim();

        if (normalized.length()
                <= DEFAULT_CHUNK_SIZE) {

            return List.of(normalized);
        }

        List<String> chunks =
                new ArrayList<>();

        int length = normalized.length();
        int start = 0;

        while (start < length) {

            int desiredEnd =
                    Math.min(
                            start + DEFAULT_CHUNK_SIZE,
                            length
                    );

            int end;

            if (desiredEnd >= length) {

                end = length;

            } else {

                end = findBestSplitPoint(
                        normalized,
                        start,
                        desiredEnd
                );
            }

            /*
             * Defensive fallback. This should normally never happen,
             * but guarantees progress if the source text contains
             * unusual formatting.
             */
            if (end <= start) {

                end = Math.min(
                        start + DEFAULT_CHUNK_SIZE,
                        length
                );
            }

            String chunk =
                    normalized
                            .substring(start, end)
                            .trim();

            if (!chunk.isBlank()) {
                chunks.add(chunk);
            }

            /*
             * substring(start, end) uses an exclusive end index.
             *
             * Start from 'end', not 'end + 1', otherwise a real
             * character can be lost when there is no whitespace at
             * the chunk boundary.
             */
            start = end;

            /*
             * Skip only whitespace between chunks.
             */
            while (start < length
                    && Character.isWhitespace(
                    normalized.charAt(start))) {

                start++;
            }
        }

        return List.copyOf(chunks);
    }

    private static int findBestSplitPoint(
            String transcript,
            int start,
            int desiredEnd) {

        int minimumSplit =
                start
                        + (int) (
                        DEFAULT_CHUNK_SIZE
                                * MIN_SPLIT_RATIO
                );

        minimumSplit =
                Math.min(
                        minimumSplit,
                        desiredEnd
                );

        /*
         * Preference 1:
         * paragraph/newline boundary.
         */
        int newline =
                transcript.lastIndexOf(
                        '\n',
                        desiredEnd
                );

        if (newline >= minimumSplit) {
            return newline + 1;
        }

        /*
         * Preference 2:
         * sentence boundary.
         */
        int sentence =
                findLastSentenceBoundary(
                        transcript,
                        minimumSplit,
                        desiredEnd
                );

        if (sentence >= minimumSplit) {
            return sentence;
        }

        /*
         * Preference 3:
         * ordinary whitespace.
         */
        int whitespace =
                transcript.lastIndexOf(
                        ' ',
                        desiredEnd
                );

        if (whitespace >= minimumSplit) {
            return whitespace;
        }

        /*
         * Last resort:
         * hard split exactly at the configured size.
         */
        return desiredEnd;
    }

    private static int findLastSentenceBoundary(
            String transcript,
            int minimumSplit,
            int desiredEnd) {

        for (int index = desiredEnd - 1;
             index >= minimumSplit;
             index--) {

            char current =
                    transcript.charAt(index);

            if (current != '.'
                    && current != '?'
                    && current != '!') {
                continue;
            }

            int next = index + 1;

            /*
             * Prefer punctuation followed by whitespace/end,
             * reducing the likelihood of splitting decimals,
             * URLs, package names, etc.
             */
            if (next >= transcript.length()
                    || Character.isWhitespace(
                    transcript.charAt(next))) {

                return next;
            }
        }

        return -1;
    }

    public static int estimateRequiredChunks(
            String transcript) {

        /*
         * Use the actual splitting algorithm rather than an arithmetic
         * approximation. Sentence-aware splitting can create boundaries
         * slightly before DEFAULT_CHUNK_SIZE.
         */
        return chunkTranscript(transcript).size();
    }

    public static boolean isWithinAiBudget(
            String transcript) {

        int chunks =
                estimateRequiredChunks(transcript);

        return chunks > 0
                && chunks <= MAX_AI_CHUNKS;
    }
}