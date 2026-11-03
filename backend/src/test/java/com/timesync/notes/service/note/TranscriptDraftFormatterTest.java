package com.timesync.notes.service.note;

import com.timesync.notes.dto.response.TranscriptSegmentDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.util.Arrays;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class TranscriptDraftFormatterTest {
    private final TranscriptDraftFormatter formatter = new TranscriptDraftFormatter();

    @Test void preservesExactEnglishDraftAndTimestampBoundaries() {
        assertEquals("## Video information\n\n- **Title:** Lesson\n- **Channel:** Teacher\n"
                        + "- **Duration:** 01:01:01\n- **Transcript language:** en\n\n"
                        + "## Original transcript\n\n**[00:00]** Start\n\n**[01:01:01]** हिन्दी café",
                formatter.format(" Lesson ", "Teacher", "01:01:01", "en", List.of(
                        new TranscriptSegmentDto(-1, 0, " Start "),
                        new TranscriptSegmentDto(3661.9, 0, "हिन्दी café"))));
    }

    @ParameterizedTest
    @CsvSource({"hi,वीडियो जानकारी,मूल ट्रांसक्रिप्ट", "es,Información del video,Transcripción original",
            "fr,Informations vidéo,Transcription originale", "de,Videoinformationen,Originaltranskript",
            "und,Video information,Original transcript"})
    void preservesLocalizedHeadings(String language, String heading, String transcriptHeading) {
        String draft = formatter.format("Lesson", "Teacher", "10:00", language,
                List.of(new TranscriptSegmentDto(12, 0, "Words")));
        assertTrue(draft.startsWith("## " + heading + "\n\n"));
        assertTrue(draft.contains("## " + transcriptHeading + "\n\n**[00:12]** Words"));
    }

    @Test void preservesMissingAndBlankSegmentBehavior() {
        assertTrue(formatter.format(null, null, null, null, null).endsWith("Transcript text is unavailable."));
        String draft = formatter.format("A\u0000B", "C", "", "en",
                Arrays.asList(null, new TranscriptSegmentDto(0, 0, " "), new TranscriptSegmentDto(1, 1, "Text")));
        assertTrue(draft.contains("**Title:** AB"));
        assertTrue(draft.endsWith("**[00:01]** Text"));
    }
}
