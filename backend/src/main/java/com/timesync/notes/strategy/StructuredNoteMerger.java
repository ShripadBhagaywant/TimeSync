package com.timesync.notes.strategy;

import com.timesync.notes.dto.response.ChapterDto;
import com.timesync.notes.dto.response.CleanedNoteResponse;
import org.springframework.stereotype.Component;
import java.util.*;

/** Deterministic aggregation of ordered chunks from ONE video, without provider calls. */
@Component
public class StructuredNoteMerger {
    public CleanedNoteResponse merge(List<CleanedNoteResponse> chunks) {
        List<String> blocks = new ArrayList<>();
        Map<ChapterKey, ChapterDto> chapters = new LinkedHashMap<>();
        for (CleanedNoteResponse chunk : chunks) {
            if (chunk == null) continue;
            // Resolve complete duplicates while the chunk's final section boundary is known.
            List<String> next = deduplicateAdjacentSections(markdownBlocks(chunk.cleanedNotes()));
            // Only exact suffix/prefix blocks at the chunk boundary are overlap.
            int overlap = Math.min(blocks.size(), next.size());
            while (overlap > 0 && !blocks.subList(blocks.size() - overlap, blocks.size())
                    .equals(next.subList(0, overlap))) overlap--;
            for (String block : next.subList(overlap, next.size())) {
                if (!blocks.isEmpty() && block.matches("#{1,6} .+")
                        && blocks.get(blocks.size() - 1).equals(block)) continue;
                blocks.add(block);
            }
            if (chunk.chapters() != null) for (ChapterDto chapter : chunk.chapters()) {
                if (chapter != null) chapters.putIfAbsent(
                        new ChapterKey(chapter.startTimestampSeconds(), chapter.title()), chapter);
            }
        }
        return new CleanedNoteResponse(String.join("\n\n", deduplicateAdjacentSections(blocks)),
                List.copyOf(chapters.values()));
    }

    // A section is a heading plus its blocks up to the next heading. Compare complete,
    // adjacent sections only: a repeated heading with different content is legitimate.
    private static List<String> deduplicateAdjacentSections(List<String> blocks) {
        List<String> result = new ArrayList<>();
        List<String> previousSection = List.of();
        for (int start = 0; start < blocks.size();) {
            if (!blocks.get(start).matches("#{1,6} .+")) {
                result.add(blocks.get(start++));
                previousSection = List.of();
                continue;
            }
            int end = start + 1;
            while (end < blocks.size() && !blocks.get(end).matches("#{1,6} .+")) end++;
            List<String> section = blocks.subList(start, end);
            if (!section.equals(previousSection)) result.addAll(section);
            previousSection = section;
            start = end;
        }
        return result;
    }

    // Blank-line blocks, with fenced code kept opaque (including internal blank lines).
    static List<String> markdownBlocks(String text) {
        if (text == null || text.isBlank()) return List.of();
        List<String> blocks = new ArrayList<>();
        StringBuilder block = new StringBuilder();
        String fence = null;
        for (String line : text.replace("\r\n", "\n").split("\n", -1)) {
            String marker = line.stripLeading();
            if (fence == null && line.matches("#{1,6} .+")) {
                if (!block.isEmpty()) { blocks.add(block.toString()); block.setLength(0); }
                blocks.add(line);
                continue;
            }
            if (fence == null && marker.matches("(`{3,}|~{3,}).*")) {
                int count = 0;
                while (count < marker.length() && marker.charAt(count) == marker.charAt(0)) count++;
                fence = marker.substring(0, count);
            } else if (fence != null && marker.matches(java.util.regex.Pattern.quote(fence.charAt(0) + "")
                    + "{" + fence.length() + ",}\\s*")) fence = null;
            if (line.isBlank() && fence == null) {
                if (!block.isEmpty()) { blocks.add(block.toString()); block.setLength(0); }
            } else {
                if (!block.isEmpty()) block.append('\n');
                block.append(line);
            }
        }
        if (!block.isEmpty()) blocks.add(block.toString());
        return blocks;
    }
    private record ChapterKey(long seconds, String title) {}
}
