package com.timesync.notes.util;

import com.timesync.notes.dto.response.ChapterDto;
import com.timesync.notes.dto.response.TranscriptSegmentDto;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Component
public class PastedTranscriptParser {

    private static final Pattern TIMESTAMP = Pattern.compile(
            "^\\s*(?:(\\d{1,3}):)?(\\d{1,2}):(\\d{2})\\s*$");

    public ParsedTranscript parse(String rawTranscript, List<ChapterDto> nativeChapters) {
        String normalized = rawTranscript == null
                ? ""
                : rawTranscript.replace("\r\n", "\n").replace('\r', '\n').trim();
        if (normalized.isBlank()) return new ParsedTranscript("", List.of(), "und");

        Set<String> chapterTitles = nativeChapters == null
                ? Set.of()
                : nativeChapters.stream()
                .map(ChapterDto::title)
                .filter(title -> title != null && !title.isBlank())
                .map(title -> title.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());

        String[] lines = normalized.split("\n");
        Map<Integer, StringBuilder> grouped = new TreeMap<>();
        List<String> prelude = new ArrayList<>();
        Integer activeSeconds = null;

        for (String sourceLine : lines) {
            String line = sourceLine.trim();
            if (line.isBlank()) continue;

            Matcher matcher = TIMESTAMP.matcher(line);
            if (matcher.matches() && isValidTimestamp(matcher)) {
                activeSeconds = toSeconds(matcher);
                grouped.computeIfAbsent(activeSeconds, ignored -> new StringBuilder());
                if (!prelude.isEmpty()) {
                    appendLines(grouped.get(activeSeconds), prelude, chapterTitles);
                    prelude.clear();
                }
                continue;
            }

            if (activeSeconds == null) {
                prelude.add(line);
            } else if (!chapterTitles.contains(line.toLowerCase(Locale.ROOT))) {
                append(grouped.get(activeSeconds), line);
            }
        }

        if (grouped.isEmpty()) {
            return new ParsedTranscript(normalized, List.of(
                    new TranscriptSegmentDto(0, 0, normalized)), detectLanguage(normalized));
        }

        List<Map.Entry<Integer, StringBuilder>> entries = grouped.entrySet().stream()
                .filter(entry -> !entry.getValue().toString().isBlank())
                .toList();
        List<TranscriptSegmentDto> segments = new ArrayList<>(entries.size());
        for (int index = 0; index < entries.size(); index++) {
            int start = entries.get(index).getKey();
            int duration = index + 1 < entries.size()
                    ? Math.max(0, entries.get(index + 1).getKey() - start)
                    : 0;
            segments.add(new TranscriptSegmentDto(
                    start,
                    duration,
                    entries.get(index).getValue().toString().trim()
            ));
        }

        String content = segments.stream()
                .map(TranscriptSegmentDto::text)
                .collect(Collectors.joining(" "))
                .replaceAll("\\s+", " ")
                .trim();
        return new ParsedTranscript(content, List.copyOf(segments), detectLanguage(content));
    }

    private boolean isValidTimestamp(Matcher matcher) {
        int minutes = Integer.parseInt(matcher.group(2));
        int seconds = Integer.parseInt(matcher.group(3));
        return seconds < 60 && (matcher.group(1) == null || minutes < 60);
    }

    private String detectLanguage(String content) {
        if (content == null || content.isBlank()) return "und";
        long letters = content.codePoints().filter(Character::isLetter).count();
        if (letters == 0) return "und";
        long devanagari = content.codePoints().filter(codePoint -> codePoint >= 0x0900 && codePoint <= 0x097F).count();
        return devanagari * 3 >= letters ? "hi" : "und";
    }

    private int toSeconds(Matcher matcher) {
        int hours = matcher.group(1) == null ? 0 : Integer.parseInt(matcher.group(1));
        int minutes = Integer.parseInt(matcher.group(2));
        int seconds = Integer.parseInt(matcher.group(3));
        return hours * 3600 + minutes * 60 + seconds;
    }

    private void appendLines(StringBuilder target, List<String> lines, Set<String> chapterTitles) {
        lines.stream()
                .filter(line -> !chapterTitles.contains(line.toLowerCase(Locale.ROOT)))
                .forEach(line -> append(target, line));
    }

    private void append(StringBuilder target, String line) {
        if (!target.isEmpty()) target.append(' ');
        target.append(line);
    }

    public record ParsedTranscript(
            String content,
            List<TranscriptSegmentDto> segments,
            String languageCode) {
    }
}
