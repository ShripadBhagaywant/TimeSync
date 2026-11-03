package com.timesync.notes.integration.youtube;

import com.timesync.notes.dto.response.ChapterDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.ArrayList;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;

class YoutubeWatchPageDataTest {
    @ParameterizedTest
    @ValueSource(strings = {"ytInitialData", "var ytInitialData", "window[ \"ytInitialData\" ]", "window['ytInitialData']"})
    void supportsAssignmentsWithFlexibleWhitespace(String assignment) {
        var data = YoutubePlayerResponseClient.parseWatchPage(assignment + "\n=\t{ \"nested\": {\"text\":\"brace } and \\\"quote\\\"\"} };");
        assertNotNull(data.initialData());
        assertFalse(data.malformed());
    }

    @Test void mergesNestedSourcesSortedAndPrefersCompleteTitles() throws Exception {
        String html = new String(getClass().getResourceAsStream("/youtube/watch-chapters.html").readAllBytes(), StandardCharsets.UTF_8);
        var data = YoutubePlayerResponseClient.parseWatchPage(html);
        var player = YoutubeChapterParser.fromPlayerResponse(data.initialPlayerResponse());
        var initial = YoutubeChapterParser.fromPlayerResponse(data.initialData());
        assertEquals(2, player.size());
        assertEquals(2, initial.size());
        var combined = new ArrayList<ChapterDto>(player);
        combined.addAll(initial);
        var result = YoutubeChapterParser.normalize(combined);
        assertEquals(3, result.size());
        assertEquals(0, result.get(0).startTimestampSeconds());
        assertEquals("Database storage internals", result.get(1).title());
        assertEquals(3601, result.get(2).startTimestampSeconds());
    }

    @Test void malformedSourceDoesNotDiscardOtherValidSource() {
        var data = YoutubePlayerResponseClient.parseWatchPage("ytInitialPlayerResponse = {invalid}; ytInitialData = {\"ok\":true};");
        assertTrue(data.malformed());
        assertNull(data.initialPlayerResponse());
        assertTrue(data.initialData().path("ok").asBoolean());
    }

    @Test void rejectsTruncatedJsonSafely() {
        var data = YoutubePlayerResponseClient.parseWatchPage("ytInitialData = {\"a\":{\"b\":1}");
        assertTrue(data.malformed());
    }

    @Test void missingAssignmentsAreGenuineEmptyResult() {
        var data = YoutubePlayerResponseClient.parseWatchPage("<html>No markers</html>");
        assertFalse(data.malformed());
        assertNull(data.initialData());
        assertNull(data.initialPlayerResponse());
    }

    @Test void descriptionSuffixHoursAndMalformedLines() {
        var chapters = YoutubeChapterParser.fromDescription("Intro 0:00\nStorage 2:30\n1:02:03 Advanced\n1:99 Invalid\nnot a chapter");
        assertEquals(3, chapters.size());
        assertEquals(150, chapters.get(1).startTimestampSeconds());
        assertEquals(3723, chapters.get(2).startTimestampSeconds());
    }
}
