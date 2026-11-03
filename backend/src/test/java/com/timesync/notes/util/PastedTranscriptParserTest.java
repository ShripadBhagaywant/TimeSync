package com.timesync.notes.util;

import com.timesync.notes.dto.response.ChapterDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class PastedTranscriptParserTest {

    private final PastedTranscriptParser parser = new PastedTranscriptParser();

    @Test
    void parsesTimestampedHindiTranscriptAndRemovesNativeChapterHeading() {
        String pasted = """
                Introduction
                0:06
                यह पहला भाग है
                0:00
                यह परिचय है
                1:02:03
                यह अंतिम भाग है
                """;

        PastedTranscriptParser.ParsedTranscript result = parser.parse(
                pasted, List.of(new ChapterDto("Introduction", 0, "00:00")));

        assertEquals("hi", result.languageCode());
        assertEquals(List.of(0.0, 6.0, 3723.0), result.segments().stream()
                .map(segment -> segment.startSeconds()).toList());
        assertFalse(result.content().contains("Introduction"));
    }
}
