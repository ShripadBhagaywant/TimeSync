package com.timesync.notes.util;

public final class SpringAiPromptEscaper {

    private SpringAiPromptEscaper() {
    }

    public static String escapeLiteralBraces(String resolvedPrompt) {
        if (resolvedPrompt == null || resolvedPrompt.isEmpty()) return "";
        return resolvedPrompt.replace("{", "\\{").replace("}", "\\}");
    }
}
