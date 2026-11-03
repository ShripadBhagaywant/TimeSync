package com.timesync.notes.strategy;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class RegexCleaningStrategy {

    private final Pattern noiseTagsPattern;
    private final Pattern extraSpacesPattern;

    public RegexCleaningStrategy(
            @Value("${app.regex.noise-tags}") String noiseTagsRegex,
            @Value("${app.regex.extra-spaces}") String extraSpacesRegex
    ) {
        this.noiseTagsPattern = Pattern.compile(noiseTagsRegex, Pattern.CASE_INSENSITIVE);
        this.extraSpacesPattern = Pattern.compile(extraSpacesRegex);
    }

    public String clean(String rawTranscript, String targetLanguage, String videoTitle) {
        if (rawTranscript == null || rawTranscript.isBlank()) {
            return "";
        }

        String cleaned = noiseTagsPattern.matcher(rawTranscript).replaceAll("");
        cleaned = extraSpacesPattern.matcher(cleaned).replaceAll(" ");

        return cleaned.trim();
    }
}