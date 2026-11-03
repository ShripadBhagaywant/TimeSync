package com.timesync.notes.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;

class YoutubeTranscriptPasteNormalizerTest {
    static Stream<Arguments> copies() {
        return Stream.of(
                Arguments.of("0:07\n7 seconds\nText", "0:07\nText"),
                Arguments.of("1:02\n1 minute, 2 seconds\nText", "1:02\nText"),
                Arguments.of("8:00\n8 minutes\nText", "8:00\nText"),
                Arguments.of("0:077 secondsText", "0:07\nText"),
                Arguments.of("0:1515 secondsText", "0:15\nText"),
                Arguments.of("1:021 minute, 2 secondsText", "1:02\nText"),
                Arguments.of("10:0710 minutes, 7 secondsText", "10:07\nText"),
                Arguments.of("1:02:15\n1 hour, 2 minutes, 15 seconds\nText", "1:02:15\nText"),
                Arguments.of("1:02:151 hour, 2 minutes, 15 secondsText", "1:02:15\nText"),
                Arguments.of("0:01\n1 second\nText", "0:01\nText"),
                Arguments.of("0:077 secondsआदित्य टंडन… 🙂", "0:07\nआदित्य टंडन… 🙂"),
                Arguments.of(" 0:07\r\n7 seconds\r\nहिंदी & English 🙂\r\n\r\nNext paragraph. ",
                        "0:07\nहिंदी & English 🙂\n\nNext paragraph."));
    }

    @ParameterizedTest @MethodSource("copies")
    void normalizesOnlyMatchingCopies(String input, String expected) {
        assertEquals(expected, YoutubeTranscriptPasteNormalizer.normalize(input));
        assertEquals(expected, YoutubeTranscriptPasteNormalizer.normalize(expected));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "0:07\nTranscript text\n\n1:02:15\nLong-video text",
            "The operation took 7 seconds.",
            "Wait 1 minute, 2 seconds before retrying.",
            "0:07\n9 seconds\nText",
            "0:079 secondsText",
            "1:02\n1 minute, 2 seconds is the timeout",
            "1:021 minute, 2 seconds is the timeout",
            "8:008 minutes is the timeout",
            "0:07\nThe request took 7 seconds\nthis algorithm runs in 15 seconds",
            "0:99\n99 seconds\nText",
            "1:77\n137 seconds\nText",
            "1:77:00\n1 hour, 77 minutes\nText",
            "12 seconds",
            "abc",
            "0:07\n999999999999999999 seconds\nText"
    })
    void preservesCanonicalInputAndUnrelatedOrInvalidText(String input) {
        assertEquals(input, YoutubeTranscriptPasteNormalizer.normalize(input));
    }

    @Test void blankAndNullMatchExistingParserConventions() {
        assertEquals("", YoutubeTranscriptPasteNormalizer.normalize(null));
        assertEquals("", YoutubeTranscriptPasteNormalizer.normalize(" \r\n\t "));
        assertEquals("", YoutubeTranscriptPasteNormalizer.normalize(""));
    }

    @Test void expandedAndCollapsedCopiesProduceIdenticalCanonicalSegments() {
        var parser = new PastedTranscriptParser();
        var expected = parser.parse("0:07\nपहला टेक्स्ट\n0:15\nदूसरा टेक्स्ट", List.of());
        for (String copy : List.of(
                "0:07\n7 seconds\nपहला टेक्स्ट\n\n0:15\n15 seconds\nदूसरा टेक्स्ट",
                "0:077 secondsपहला टेक्स्ट\n0:1515 secondsदूसरा टेक्स्ट")) {
            var actual = parser.parse(YoutubeTranscriptPasteNormalizer.normalize(copy), List.of());
            assertEquals(expected, actual);
            assertEquals(List.of(7.0, 15.0), actual.segments().stream().map(s -> s.startSeconds()).toList());
            assertEquals(List.of("पहला टेक्स्ट", "दूसरा टेक्स्ट"),
                    actual.segments().stream().map(s -> s.text()).toList());
        }
    }
}
