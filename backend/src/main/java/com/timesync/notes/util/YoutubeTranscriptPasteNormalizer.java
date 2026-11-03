package com.timesync.notes.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Removes matching English accessibility timestamps from YouTube clipboard text. */
public final class YoutubeTranscriptPasteNormalizer {
    private static final Pattern TIMESTAMP = Pattern.compile(
            "^(?:(\\d{1,3}):)?(\\d{1,2}):(\\d{2})");
    private static final Pattern ACCESSIBILITY = Pattern.compile(
            "(?:(\\d{1,6}) hours?(?:,?\\h+(?=\\d))?)?"
                    + "(?:(\\d{1,6}) minutes?(?:,?\\h+(?=\\d))?)?"
                    + "(?:(\\d{1,6}) seconds?)?");

    private YoutubeTranscriptPasteNormalizer() { }

    public static String normalize(String raw) {
        if (raw == null) return "";
        String[] lines = raw.replace("\r\n", "\n").replace('\r', '\n').trim().split("\n", -1);
        StringBuilder result = new StringBuilder();
        Integer precedingTimestamp = null;
        for (String source : lines) {
            String line = source.trim();
            if (precedingTimestamp != null && duplicateDuration(line, true) == precedingTimestamp.intValue()) {
                precedingTimestamp = null;
                continue;
            }
            if (!line.isEmpty()) precedingTimestamp = null;
            Matcher timestamp = TIMESTAMP.matcher(line);
            if (timestamp.find() && validTimestamp(timestamp)) {
                int seconds = number(timestamp, 1) * 3600 + number(timestamp, 2) * 60 + number(timestamp, 3);
                String remainder = line.substring(timestamp.end());
                if (remainder.isEmpty()) {
                    precedingTimestamp = seconds;
                } else {
                    Matcher duplicate = ACCESSIBILITY.matcher(remainder);
                    if (duplicate.lookingAt() && duplicate.end() > 0
                            && duplicateDuration(remainder, false) == seconds) {
                        String text = remainder.substring(duplicate.end());
                        // Only split directly merged text; spaced prose may be legitimate content.
                        if (text.isEmpty() || !Character.isWhitespace(text.charAt(0))) {
                            line = line.substring(0, timestamp.end()) + "\n" + text;
                        }
                    }
                }
            }
            if (!result.isEmpty()) result.append('\n');
            result.append(line);
        }
        return result.toString();
    }

    private static int duplicateDuration(String text, boolean wholeLine) {
        Matcher matcher = ACCESSIBILITY.matcher(text);
        if (!(wholeLine ? matcher.matches() : matcher.lookingAt()) || matcher.end() == 0) return -1;
        if (matcher.group(1) == null && matcher.group(2) == null && matcher.group(3) == null) return -1;
        long seconds = (long) number(matcher, 1) * 3600 + (long) number(matcher, 2) * 60 + number(matcher, 3);
        return seconds <= Integer.MAX_VALUE ? (int) seconds : -1;
    }

    private static boolean validTimestamp(Matcher matcher) {
        return number(matcher, 3) < 60 && (matcher.group(1) == null || number(matcher, 2) < 60);
    }

    private static int number(Matcher matcher, int group) {
        return matcher.group(group) == null ? 0 : Integer.parseInt(matcher.group(group));
    }
}
