package com.timesync.notes.service.impl;

import com.timesync.notes.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class YoutubePlayabilityErrorTest {

    @Test
    void sanitizesYoutubeBotChallengeReason() {
        String upstreamReason = "Sign in to confirm you're not a bot";
        ApiException error = YoutubeExtractionServiceImpl.playabilityFailure(upstreamReason);

        assertEquals("YOUTUBE_BOT_CHECK", error.getErrorCode());
        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatus());
        assertEquals("YouTube temporarily blocked automated transcript access. Please try again later.", error.getMessage());
        assertFalse(error.getMessage().contains(upstreamReason));
    }

    @Test
    void sanitizesOtherYoutubePlayabilityReasons() {
        String upstreamReason = "Sign in to confirm you have access to this members-only video";
        ApiException error = YoutubeExtractionServiceImpl.playabilityFailure(upstreamReason);

        assertEquals("MEMBERS_ONLY_VIDEO", error.getErrorCode());
        assertEquals("This video is private, restricted, or members-only.", error.getMessage());
        assertFalse(error.getMessage().contains(upstreamReason));
    }
}
