package com.timesync.notes.service;

import com.timesync.notes.dto.request.ShareNoteRequest;
import com.timesync.notes.dto.response.SharedNoteResponse;

public interface ShareNoteService {

    SharedNoteResponse createShareSnapshot(ShareNoteRequest request);
    SharedNoteResponse getNoteByHashId(String hashId);
}
