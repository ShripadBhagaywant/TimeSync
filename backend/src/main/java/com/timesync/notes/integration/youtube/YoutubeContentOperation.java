package com.timesync.notes.integration.youtube;

public enum YoutubeContentOperation {
    CHAPTER_DISCOVERY, WATCH_PAGE, TIMEDTEXT_DISCOVERY, SUBTITLE_DOWNLOAD;

    public YoutubeAvailabilityScope scope() {
        return switch (this) {
            case CHAPTER_DISCOVERY, WATCH_PAGE -> YoutubeAvailabilityScope.WATCH_PAGE;
            case TIMEDTEXT_DISCOVERY, SUBTITLE_DOWNLOAD -> YoutubeAvailabilityScope.CAPTION;
        };
    }
}