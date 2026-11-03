package com.timesync.notes.util;

import com.timesync.notes.model.ExtractedTranscript;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class VttSubtitleParserTest {

    @Test
    void preservesCueTimingAndDeduplicatesRollingCaptions() {
        String vtt = """
                WEBVTT

                00:00:01.000 --> 00:00:03.000
                Hello

                00:00:03.000 --> 00:00:05.500
                Hello world

                00:01:02.250 --> 00:01:05.000
                <c>Next topic</c>
                """;

        ExtractedTranscript result = VttSubtitleParser.parse(vtt, "en", true);

        assertEquals("Hello world Next topic", result.content());
        assertEquals(3, result.segments().size());
        assertEquals(1.0, result.segments().get(0).startSeconds());
        assertEquals("world", result.segments().get(1).text());
        assertEquals(62.25, result.segments().get(2).startSeconds());
        assertFalse(result.segments().get(2).text().contains("<c>"));
    }
}
