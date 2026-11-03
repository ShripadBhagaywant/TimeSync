package com.timesync.notes.util;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.prompt.PromptTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SpringAiPromptEscaperTest {

    @Test
    void keepsJsonAndCodeBracesLiteralDuringSpringAiRendering() {
        String source = "Schema: {\"cleanedNotes\": \"text\"}\nclass Example { void run() {} }";

        String rendered = new PromptTemplate(
                SpringAiPromptEscaper.escapeLiteralBraces(source)).render();

        assertEquals(source, rendered.replace("\r\n", "\n"));
    }
}
