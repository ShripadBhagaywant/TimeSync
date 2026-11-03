package com.timesync.notes.service;

import com.timesync.notes.model.ChapterDiscoveryResult;
import com.timesync.notes.model.ExtractedTranscript;

import com.timesync.notes.dto.response.ChapterDto;

import java.util.List;

public interface VideoExtractionService {

    ExtractedTranscript extractTranscript(String videoId, String targetLanguage);

    List<ChapterDto> extractChapters(String videoId);

    default ChapterDiscoveryResult discoverChapters(String videoId) {
        return ChapterDiscoveryResult.found(extractChapters(videoId));
    }

    String getVideoTitle(String videoId);

    String getVideoChannelName(String videoId);

    String getVideoDuration(String videoId);

    String getVideoCategoryId(String videoId);

    String getVideoDescription(String videoId);

    List<String> getVideoTags(String videoId);
}
