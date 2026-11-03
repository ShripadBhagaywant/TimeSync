package com.timesync.notes.service;

import com.timesync.notes.dto.request.ExtractVideoRequest;
import com.timesync.notes.dto.request.ImportTranscriptRequest;
import com.timesync.notes.dto.request.RefineTranscriptRequest;
import com.timesync.notes.dto.response.TranscriptResponse;

public interface TranscriptCleaningService {

    TranscriptResponse extractAndProcess(ExtractVideoRequest request);

    TranscriptResponse importTranscript(ImportTranscriptRequest request);

    TranscriptResponse refineTranscript(RefineTranscriptRequest request);

}
