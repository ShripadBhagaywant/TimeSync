package com.timesync.notes.service.note;

import com.timesync.notes.dto.response.TranscriptSegmentDto;
import org.springframework.stereotype.Component;
import java.util.List;

/** Renders a source draft without extraction, eligibility checks, or provider calls. */
@Component
public class TranscriptDraftFormatter {
    public String format(
            String title,
            String channelName,
            String duration,
            String languageCode,
            List<TranscriptSegmentDto> segments) {

        DraftLabels labels = draftLabels(languageCode);

        StringBuilder draft = new StringBuilder()
                .append("## ").append(labels.videoInformation()).append("\n\n")
                .append("- **").append(labels.title()).append(":** ").append(metadataValue(title, "")).append('\n')
                .append("- **").append(labels.channel()).append(":** ").append(metadataValue(channelName, "")).append('\n')
                .append("- **").append(labels.duration()).append(":** ").append(metadataValue(duration, "")).append('\n')
                .append("- **").append(labels.transcriptLanguage()).append(":** ")
                .append(metadataValue(languageCode, labels.unknown())).append("\n\n");

        draft.append("## ").append(labels.originalTranscript()).append("\n\n");

        if (segments == null || segments.isEmpty()) {
            draft.append("Transcript text is unavailable.");
            return draft.toString();
        }

        for (TranscriptSegmentDto segment : segments) {
            if (segment == null || segment.text() == null || segment.text().isBlank()) {
                continue;
            }

            draft.append("**[")
                    .append(formatTimestamp(segment.startSeconds()))
                    .append("]** ")
                    .append(segment.text().trim())
                    .append("\n\n");
        }

        return draft.toString().trim();
    }

    private String formatTimestamp(double seconds) {
        long totalSeconds = Math.max(0, (long) Math.floor(seconds));
        long hours = totalSeconds / 3600;
        long minutes = (totalSeconds % 3600) / 60;
        long remainingSeconds = totalSeconds % 60;

        return hours > 0
                ? String.format("%02d:%02d:%02d", hours, minutes, remainingSeconds)
                : String.format("%02d:%02d", minutes, remainingSeconds);
    }

    private DraftLabels draftLabels(String languageCode) {
        String language = languageCode == null ? "" : languageCode.toLowerCase();

        if (language.startsWith("hi")) {
            return new DraftLabels(
                    "वीडियो जानकारी",
                    "शीर्षक",
                    "चैनल",
                    "अवधि",
                    "ट्रांसक्रिप्ट भाषा",
                    "मूल ट्रांसक्रिप्ट",
                    "अज्ञात"
            );
        }

        if (language.startsWith("es")) {
            return new DraftLabels(
                    "Información del video",
                    "Título",
                    "Canal",
                    "Duración",
                    "Idioma de la transcripción",
                    "Transcripción original",
                    "Desconocido"
            );
        }

        if (language.startsWith("fr")) {
            return new DraftLabels(
                    "Informations vidéo",
                    "Titre",
                    "Chaîne",
                    "Durée",
                    "Langue de transcription",
                    "Transcription originale",
                    "Inconnue"
            );
        }

        if (language.startsWith("de")) {
            return new DraftLabels(
                    "Videoinformationen",
                    "Titel",
                    "Kanal",
                    "Dauer",
                    "Transkriptsprache",
                    "Originaltranskript",
                    "Unbekannt"
            );
        }

        return new DraftLabels(
                "Video information",
                "Title",
                "Channel",
                "Duration",
                "Transcript language",
                "Original transcript",
                "Unknown"
        );
    }

    private record DraftLabels(
            String videoInformation,
            String title,
            String channel,
            String duration,
            String transcriptLanguage,
            String originalTranscript,
            String unknown) {
    }

    private String metadataValue(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value.trim().replace("\u0000", "");
    }
}
