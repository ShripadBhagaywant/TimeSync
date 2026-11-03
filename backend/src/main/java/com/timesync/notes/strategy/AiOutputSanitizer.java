package com.timesync.notes.strategy;

import com.timesync.notes.dto.response.CleanedNoteResponse;
import org.springframework.stereotype.Component;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Conservative prose cleanup. Fenced code and language-significant joiners stay intact. */
@Component
public class AiOutputSanitizer {
    public CleanedNoteResponse sanitize(CleanedNoteResponse draft, String targetLanguage) {
        List<String> lines = new ArrayList<>();
        String fence = null;
        int blanks = 0;
        String notes = draft.cleanedNotes() == null ? "" : draft.cleanedNotes();
        for (String line : notes.replace("\r\n", "\n").split("\n", -1)) {
            String marker = line.stripLeading();
            if (fence != null) {
                lines.add(line);
                if (marker.matches(Pattern.quote(fence.charAt(0) + "") + "{" + fence.length() + ",}\\s*")) fence = null;
                continue;
            }
            if (marker.matches("(`{3,}|~{3,}).*")) {
                int count = 0;
                while (count < marker.length() && marker.charAt(count) == marker.charAt(0)) count++;
                fence = marker.substring(0, count);
                lines.add(line);
                blanks = 0;
                continue;
            }
            String cleaned = Normalizer.normalize(line, Normalizer.Form.NFC)
                    .replace("\u200B", "").replace("\uFEFF", "")
                    .replaceAll("[\\p{Cc}&&[^\\n\\r\\t]]", "")
                    // ZWJ/ZWNJ affect Indic/Persian words and emoji: remove only ASCII corruption.
                    .replaceAll("(?<=[A-Za-z0-9])[\u200C\u200D]+(?=[A-Za-z0-9])", "")
                    .replaceAll("(`[^`\\n]+`)\\*\\*:\\*\\*", "$1:");
            // Markdown may escape only the first hyphen, every hyphen, or spaced hyphens.
            // Restrict this repair to an entire separator line, never inline prose/code.
            String separator = cleaned.trim();
            if (separator.contains("\\-")
                    && separator.replace("\\-", "-").matches("(?:-[ \\t]*){3,}")) cleaned = "---";
            // Preserve Markdown's meaningful two-space hard break.
            cleaned = cleaned.replaceAll("[ \\t]+$", cleaned.endsWith("  ") ? "  " : "");
            if (cleaned.isBlank()) { if (++blanks > 2) continue; cleaned = ""; }
            else blanks = 0;
            lines.add(cleaned);
        }
        return new CleanedNoteResponse(String.join("\n", lines),
                draft.chapters() == null ? List.of() : List.copyOf(draft.chapters()));
    }
}
