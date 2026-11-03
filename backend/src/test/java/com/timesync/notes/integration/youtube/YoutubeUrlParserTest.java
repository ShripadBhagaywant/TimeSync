package com.timesync.notes.integration.youtube;

import com.timesync.notes.exception.ApiException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class YoutubeUrlParserTest {

    private static final String VIDEO_ID = "dQw4w9WgXcQ";

    @Test
    void acceptsSupportedVideoFormats() {
        assertEquals(VIDEO_ID, YoutubeUrlParser.extractVideoId(VIDEO_ID));
        assertEquals(VIDEO_ID, YoutubeUrlParser.extractVideoId("https://youtu.be/" + VIDEO_ID));
        assertEquals(VIDEO_ID, YoutubeUrlParser.extractVideoId("https://www.youtube.com/watch?v=" + VIDEO_ID + "&list=PL123456789012"));
        assertEquals(VIDEO_ID, YoutubeUrlParser.extractVideoId("https://youtube.com/shorts/" + VIDEO_ID));
        assertEquals(VIDEO_ID, YoutubeUrlParser.extractVideoId("https://m.youtube.com/live/" + VIDEO_ID + "?feature=share"));
        assertEquals(VIDEO_ID, YoutubeUrlParser.extractVideoId("https://www.youtube-nocookie.com/embed/" + VIDEO_ID));
    }

    @Test
    void rejectsNonYoutubeHostsAndMalformedIds() {
        assertThrows(ApiException.class, () ->
                YoutubeUrlParser.extractVideoId("https://example.com/watch?v=" + VIDEO_ID));
        assertThrows(ApiException.class, () ->
                YoutubeUrlParser.extractVideoId("https://youtube.com/watch?v=short"));
    }

    @Test
    void acceptsPlaylistAndWatchPlaylistUrls() {
        String playlistId = "PL12345678901234567890";
        assertEquals(playlistId, YoutubePlaylistParser.extractPlaylistId(playlistId));
        assertEquals(
                playlistId,
                YoutubePlaylistParser.extractPlaylistId(
                        "https://www.youtube.com/playlist?list=" + playlistId
                )
        );
        assertEquals(
                playlistId,
                YoutubePlaylistParser.extractPlaylistId(
                        "https://www.youtube.com/watch?v=" + VIDEO_ID + "&list=" + playlistId
                )
        );
    }
}
