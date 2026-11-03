package com.timesync.notes.service;

import com.timesync.notes.dto.request.ExtractPlaylistRequest;
import com.timesync.notes.dto.response.PlaylistJobResponse;
import com.timesync.notes.dto.response.PlaylistTranscriptResponse;
import com.timesync.notes.exception.ApiException;
import com.timesync.notes.exception.ResourceNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.slf4j.MDC;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;

@Slf4j
@Service
public class PlaylistJobService {

    private static final int MAX_RETAINED_JOBS = 100;
    private static final Duration COMPLETED_JOB_TTL = Duration.ofHours(2);

    private final PlaylistExtractionService playlistExtractionService;
    private final ExecutorService playlistJobExecutor;
    private final Map<String, PlaylistJobState> jobs = new ConcurrentHashMap<>();

    public PlaylistJobService(
            PlaylistExtractionService playlistExtractionService,
            @Qualifier("playlistJobExecutor") ExecutorService playlistJobExecutor) {
        this.playlistExtractionService = playlistExtractionService;
        this.playlistJobExecutor = playlistJobExecutor;
    }

    public PlaylistJobResponse submit(ExtractPlaylistRequest request) {
        cleanupExpiredJobs();
        if (jobs.size() >= MAX_RETAINED_JOBS) {
            throw new ApiException(
                    "The playlist job queue is full. Please retry shortly.",
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "PLAYLIST_QUEUE_FULL"
            );
        }

        String jobId = UUID.randomUUID().toString();
        String traceId = java.util.Optional.ofNullable(MDC.get("traceId"))
                .orElseGet(() -> UUID.randomUUID().toString().substring(0, 8));
        PlaylistJobState state = new PlaylistJobState(jobId, traceId);
        jobs.put(jobId, state);

        try {
            playlistJobExecutor.execute(() -> process(state, request));
        } catch (RejectedExecutionException ex) {
            jobs.remove(jobId);
            throw new ApiException(
                    "The playlist job queue is busy. Please retry shortly.",
                    ex,
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "PLAYLIST_QUEUE_BUSY"
            );
        }

        return state.snapshot();
    }

    public PlaylistJobResponse get(String jobId) {
        cleanupExpiredJobs();
        PlaylistJobState state = jobs.get(jobId);
        if (state == null) {
            throw new ResourceNotFoundException("Playlist job was not found or has expired.");
        }
        return state.snapshot();
    }

    private void process(PlaylistJobState state, ExtractPlaylistRequest request) {
        try (MDC.MDCCloseable ignored = MDC.putCloseable("traceId", state.traceId)) {
            state.processing();
            try {
                PlaylistTranscriptResponse result = playlistExtractionService.extractPlaylist(request);
                state.completed(result);
            } catch (Exception ex) {
                ApiException apiException = findApiException(ex);
                FailureDescription failure = apiException == null
                        ? describeUnexpectedFailure(ex, state.traceId)
                        : new FailureDescription(apiException.getErrorCode(), apiException.getMessage());
                String code = failure.code();
                String message = failure.message();
                state.failed(code, message);
                log.error("Playlist job {} failed with code {}; error={}", state.jobId, code, ex.getClass().getSimpleName());
            }
        }
    }

    private FailureDescription describeUnexpectedFailure(Throwable throwable, String traceId) {
        Throwable current = throwable;
        for (int depth = 0; current != null && depth < 12; depth++) {
            if (current instanceof ResourceAccessException || current instanceof HttpServerErrorException) {
                return new FailureDescription(
                        "UPSTREAM_SERVICE_UNAVAILABLE",
                        "YouTube playlist services are temporarily unavailable. Please retry shortly."
                );
            }
            if (current instanceof RestClientResponseException responseException) {
                return new FailureDescription(
                        "YOUTUBE_PLAYLIST_API_ERROR",
                        "YouTube could not load this playlist (HTTP " + responseException.getStatusCode().value() + ")."
                );
            }
            current = current.getCause();
        }
        return new FailureDescription(
                "PLAYLIST_PROCESSING_FAILED",
                "Playlist processing failed. Reference ID: " + traceId
        );
    }

    private ApiException findApiException(Throwable throwable) {
        Throwable current = throwable;
        for (int depth = 0; current != null && depth < 12; depth++) {
            if (current instanceof ApiException apiException) {
                return apiException;
            }
            current = current.getCause();
        }
        return null;
    }

    private void cleanupExpiredJobs() {
        Instant cutoff = Instant.now().minus(COMPLETED_JOB_TTL);
        jobs.entrySet().removeIf(entry -> entry.getValue().isTerminalBefore(cutoff));
    }

    private static final class PlaylistJobState {
        private final String jobId;
        private final String traceId;
        private final Instant createdAt;
        private volatile String status = "QUEUED";
        private volatile String message = "Playlist job is queued.";
        private volatile PlaylistTranscriptResponse result;
        private volatile String errorCode;
        private volatile String errorMessage;
        private volatile Instant updatedAt;

        private PlaylistJobState(String jobId, String traceId) {
            this.jobId = jobId;
            this.traceId = traceId;
            this.createdAt = Instant.now();
            this.updatedAt = createdAt;
        }

        private void processing() {
            status = "PROCESSING";
            message = "Playlist videos and AI notes are being processed.";
            updatedAt = Instant.now();
        }

        private void completed(PlaylistTranscriptResponse result) {
            this.result = result;
            status = "COMPLETED";
            message = "Playlist processing completed.";
            updatedAt = Instant.now();
        }

        private void failed(String errorCode, String errorMessage) {
            this.errorCode = errorCode;
            this.errorMessage = errorMessage;
            status = "FAILED";
            message = errorMessage;
            updatedAt = Instant.now();
        }

        private boolean isTerminalBefore(Instant cutoff) {
            return ("COMPLETED".equals(status) || "FAILED".equals(status))
                    && updatedAt.isBefore(cutoff);
        }

        private PlaylistJobResponse snapshot() {
            return new PlaylistJobResponse(
                    jobId,
                    traceId,
                    status,
                    message,
                    result,
                    errorCode,
                    errorMessage,
                    createdAt,
                    updatedAt
            );
        }
    }

    private record FailureDescription(String code, String message) {
    }
}
