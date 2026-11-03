package com.timesync.notes.integration.youtube;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.timesync.notes.dto.response.ChapterDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class YoutubeChapterParserTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void parsesCreatorTimestampsFromDescription() {
        List<ChapterDto> chapters = YoutubeChapterParser.fromDescription("""
                Course links
                0:00 Introduction
                2:43 What is a Database?
                Stored Procedures 3:23:59
                """);

        assertEquals(3, chapters.size());
        assertEquals(new ChapterDto("Introduction", 0, "00:00"), chapters.get(0));
        assertEquals(12239, chapters.get(2).startTimestampSeconds());
    }

    @Test
    void parsesNativeMarkersFromPlayerResponse() throws Exception {
        JsonNode response = objectMapper.readTree("""
                {
                  "engagementPanels": [{
                    "macroMarkersListItemRenderer": {
                      "title": {"simpleText": "Creating a Table"},
                      "timeDescription": {"simpleText": "23:18"},
                      "onTap": {"watchEndpoint": {"startTimeSeconds": 1398}}
                    }
                  }]
                }
                """);

        assertEquals(
                List.of(new ChapterDto("Creating a Table", 1398, "23:18")),
                YoutubeChapterParser.fromPlayerResponse(response)
        );
    }
}
