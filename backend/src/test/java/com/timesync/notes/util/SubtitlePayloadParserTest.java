package com.timesync.notes.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;
import static com.timesync.notes.util.SubtitlePayloadParser.Reason.*;

class SubtitlePayloadParserTest {
    @Test void emptyBodyHasNoParser() {
        var result = SubtitlePayloadParser.parse("", "en", false);
        assertEquals(EMPTY_BODY, result.reason()); assertEquals("NONE", result.parser());
    }
    @Test void htmlIsTemporary() {
        var result = SubtitlePayloadParser.parse("<!doctype html><html>Consent secret</html>", "en", false);
        assertEquals(HTML_INTERSTITIAL, result.reason()); assertTrue(result.temporary());
    }
    @ParameterizedTest @ValueSource(strings = {
        "<transcript><text start='1.25' dur='2'>Variables &amp; functions explain 日本語.</text></transcript>",
        "<timedtext format='3'><head/><body><p t='1250' d='2000'><s>Variables &amp; functions explain 日本語.</s></p></body></timedtext>",
        "WEBVTT\n\n00:00:01.250 --> 00:00:03.250\nVariables &amp; functions explain 日本語.\n"})
    void legitimateFormatsPreserveTimingAndUnicode(String payload) {
        var result = SubtitlePayloadParser.parse(payload, "en", true);
        assertEquals(OK, result.reason()); assertEquals(1, result.parsedCueCount());
        assertEquals(1.25, result.transcript().segments().get(0).startSeconds());
        assertEquals(2, result.transcript().segments().get(0).durationSeconds());
        assertEquals("Variables & functions explain 日本語.", result.transcript().content());
    }
    @ParameterizedTest @ValueSource(strings = {"<transcript><text>", "WEBVTT\n\nbad --> timing\ntext", "<transcript><text start='NaN'>Hello</text></transcript>"})
    void malformedPayloadIsTemporary(String payload) {
        var result = SubtitlePayloadParser.parse(payload, "en", false);
        assertEquals(MALFORMED_CAPTION_PAYLOAD, result.reason()); assertTrue(result.temporary());
    }
    @Test void distinguishEmptyCuesFromNoCuesAndShortText() {
        assertEquals(NO_CUES, SubtitlePayloadParser.parse("<transcript/>", "en", false).reason());
        var empty = SubtitlePayloadParser.parse("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n<c></c>\n", "en", false);
        assertEquals(1, empty.parsedCueCount()); assertEquals(POST_PARSE_EMPTY, empty.reason());
        assertEquals(TRACK_NOT_USABLE, SubtitlePayloadParser.parse("<transcript><text start='0'>Hi</text></transcript>", "en", false).reason());
    }
    @Test void unknownXmlIsNotNormalAbsence() {
        assertEquals(UNSUPPORTED_FORMAT, SubtitlePayloadParser.parse("<error>Retry</error>", "en", false).reason());
    }
}
