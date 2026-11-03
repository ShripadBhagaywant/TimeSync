package com.timesync.notes.strategy;

import com.timesync.notes.dto.response.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiPostProcessingTest {
    @Test void snapshotSanitizerPreservesHeadingIndentationWithoutExecutableHtml() {
        String safe = new com.timesync.notes.security.InputSanitizer().sanitizeRichHtml(
                "<h6 data-indent=\"2\" onclick=\"alert(1)\">Heading</h6><script>alert(1)</script>");
        assertEquals("<h6 data-indent=\"2\">Heading</h6>", safe);
    }
    private final StructuredNoteMerger merger = new StructuredNoteMerger();
    private final AiOutputSanitizer sanitizer = new AiOutputSanitizer();
    private CleanedNoteResponse note(String text) { return new CleanedNoteResponse(text, List.of()); }

    @Test void normalizesOnlyStandaloneEscapedHorizontalRules() {
        String input = "\\---\n\\-\\-\\-\n\\- - \\-\n---\nInline \\--- text\n\\--";
        assertEquals("---\n---\n---\n---\nInline \\--- text\n\\--",
                sanitizer.sanitize(note(input), "English").cleanedNotes());
    }

    @Test void mergesExactAdjacentSectionsWithoutRemovingDifferentOrDistantContent() {
        String section = "## Topic\n\nहिन्दी café\n\nMore details";
        String different = "## Topic\n\nDifferent context";
        assertEquals(section + "\n\n" + different + "\n\n" + section,
                merger.merge(List.of(note(section + "\n\n" + section + "\n\n" + different),
                        note(section))).cleanedNotes());
    }

    @Test void finalDraftUsesRealChunkCollectionThenRealMergeAndSanitation() {
        var executor = java.util.concurrent.Executors.newSingleThreadExecutor();
        try {
            var calls = new java.util.ArrayList<Integer>();
            String section = "## Topic\n\nहिन्दी cafe\u0301";
            String code = "~~~text\n\\---\n## Same\n## Same\na\u200Bb  \n~~~";
            var strategy = new GeminiAiCleaningStrategy(null, executor, "prompt", 60, "primary", "fallback",
                    (chunk, index, total, title, language, hasChapters, model) -> {
                        calls.add(index);
                        return note(index == 1 ? section + "\n\n" + section
                                : "\\---\n\n" + code + "\n\n## End " + index);
                    });
            String source = "A sentence with enough words for chunking. ".repeat(1400);
            int expectedChunks = com.timesync.notes.util.TranscriptChunker.chunkTranscript(source).size();
            String output = strategy.processStructuredNotes(source, "English", "Video", false).cleanedNotes();
            assertTrue(expectedChunks >= 2);
            assertEquals(java.util.stream.IntStream.rangeClosed(1, expectedChunks).boxed().toList(), calls);
            assertTrue(output.startsWith("## Topic\n\nहिन्दी café\n\n---\n\n"));
            assertEquals(1, output.split("## Topic", -1).length - 1);
            for (int index = 2; index <= expectedChunks; index++) assertTrue(output.contains("## End " + index));
            assertTrue(output.contains(code), "Fenced code must survive merge and sanitation unchanged");
            assertFalse(output.replace(code, "").contains("\\---"));
        } finally { executor.shutdownNow(); }
    }

    @Test void preservesOrderAndRemovesOnlyBoundaryOverlap() {
        var result = merger.merge(List.of(note("## A\n\nFirst\n\nOverlap"),
                note("Overlap\n\n## B\n\nSecond\n\nFirst")));
        assertEquals("## A\n\nFirst\n\nOverlap\n\n## B\n\nSecond\n\nFirst", result.cleanedNotes());
    }
    @Test void removesAdjacentHeadingsButKeepsDifferentContexts() {
        assertEquals("## A\n\nBody\n\n## B\n\nBody",
                merger.merge(List.of(note("## A\n## A\n\nBody"), note("## B\n\nBody"))).cleanedNotes());
    }
    @Test void deduplicatesChapterIdentityWithoutChangingTimes() {
        var a = new ChapterDto("Intro", 10, "00:10");
        var b = new ChapterDto("Intro", 20, "00:20");
        var c = new ChapterDto("Other", 10, "00:10");
        assertEquals(List.of(a,b,c), merger.merge(List.of(
                new CleanedNoteResponse("A", List.of(a)), new CleanedNoteResponse("B", List.of(a,b,c)))).chapters());
    }
    @Test void cleansDeterministicArtifactsAndPreservesLanguages() {
        var result = sanitizer.sanitize(note("\\-\\-\\-\n`type`**:**\na\u200Bb\u200Dc\uFEFF\u0001\nहिन्दी क्\u200Dष فارسی می\u200Cروم cafe\u0301\n\n\n\nEnd"), "English");
        assertEquals("---\n`type`:\nabc\nहिन्दी क्\u200Dष فارسی می\u200Cروم café\n\n\nEnd", result.cleanedNotes());
    }
    @Test void preservesFencedCodeAndSuspiciousMixedScript() {
        String text = "```java\n`type`**:**\n\\-\\-\\-\n\n\na\u200Bb  \n```\nsuper把我class";
        assertEquals(text, sanitizer.sanitize(note(text), "English").cleanedNotes());
        assertEquals(text, merger.merge(List.of(note(text))).cleanedNotes().replace("```\n\n", "```\n"));
    }
    @Test void invokesSanitizerAfterMerger() {
        var merge = mock(StructuredNoteMerger.class);
        var clean = mock(AiOutputSanitizer.class);
        var strategy = spy(new GeminiAiCleaningStrategy(null, null, "prompt", 60, "primary", "fallback", merge, clean, new com.timesync.notes.service.TranscriptChunkService(null)));
        var chunks = List.of(note("raw"));
        var merged = note("merged");
        var finalDraft = note("final");
        doReturn(chunks).when(strategy).processChunks("source", "English", "Video", false);
        when(merge.merge(chunks)).thenReturn(merged);
        when(clean.sanitize(merged, "English")).thenReturn(finalDraft);
        assertSame(finalDraft, strategy.processStructuredNotes("source", "English", "Video", false));
        var order = inOrder(merge, clean);
        order.verify(merge).merge(chunks);
        order.verify(clean).sanitize(merged, "English");
    }
    @Test void preAiCleaningPreservesLineBreaksAndUnicode() {
        var regex = new RegexCleaningStrategy("\\[music\\]", "[ \\t]+");
        assertEquals("हिन्दी café\nNext", regex.clean("[music] हिन्दी   café\nNext", "Hindi", "Video"));
    }
}

