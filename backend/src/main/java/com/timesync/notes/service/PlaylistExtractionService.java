package com.timesync.notes.service;

import com.timesync.notes.dto.request.ExtractPlaylistRequest;
import com.timesync.notes.dto.response.PlaylistTranscriptResponse;

public interface PlaylistExtractionService {
    PlaylistTranscriptResponse extractPlaylist(ExtractPlaylistRequest request);
}
