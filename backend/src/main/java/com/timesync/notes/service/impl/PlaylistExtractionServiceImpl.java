package com.timesync.notes.service.impl;

import com.timesync.notes.dto.request.ExtractPlaylistRequest;
import com.timesync.notes.dto.request.ExtractVideoRequest;
import com.timesync.notes.dto.response.PlaylistItemFailure;
import com.timesync.notes.dto.response.PlaylistTranscriptResponse;
import com.timesync.notes.dto.response.TranscriptResponse;
import com.timesync.notes.exception.ApiException;
import com.timesync.notes.exception.UpstreamRateLimitException;
import com.timesync.notes.entity.NoteSource;
import com.timesync.notes.entity.TranscriptAvailability;
import com.timesync.notes.service.PlaylistExtractionService;
import com.timesync.notes.service.TranscriptCleaningService;
import com.timesync.notes.integration.youtube.YoutubeAvailabilityGuard;
import com.timesync.notes.integration.youtube.YoutubeAvailabilityScope;
import com.timesync.notes.integration.youtube.YoutubePlaylistParser;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class PlaylistExtractionServiceImpl implements PlaylistExtractionService {

    private final TranscriptCleaningService transcriptCleaningService;
    private final YoutubeDataApiService youtubeDataApiService;
    private final ExecutorService playlistBatchExecutor;
    private final int batchSize;
    private final long batchTimeoutSeconds;
    private final int maxPlaylistVideos;
    private final YoutubeAvailabilityGuard youtubeAvailabilityGuard;

    public PlaylistExtractionServiceImpl(
            TranscriptCleaningService transcriptCleaningService,
            YoutubeDataApiService youtubeDataApiService,
            @Qualifier("playlistBatchExecutor") ExecutorService playlistBatchExecutor,
            @Value("${app.playlist.batch-size:8}") int batchSize,
            @Value("${app.playlist.batch-timeout-seconds:900}") long batchTimeoutSeconds,
            @Value("${app.youtube.max-playlist-videos:250}") int maxPlaylistVideos,
            YoutubeAvailabilityGuard youtubeAvailabilityGuard) {
        this.transcriptCleaningService = transcriptCleaningService;
        this.youtubeDataApiService = youtubeDataApiService;
        this.playlistBatchExecutor = playlistBatchExecutor;
        this.batchSize = Math.max(1, Math.min(batchSize, 25));
        this.batchTimeoutSeconds = Math.max(30, batchTimeoutSeconds);
        this.maxPlaylistVideos = Math.max(1, maxPlaylistVideos);
        this.youtubeAvailabilityGuard = youtubeAvailabilityGuard;
    }

    @Override
    @Cacheable(
            value = "playlistNotes",
            key = "'v5:' + T(com.timesync.notes.integration.youtube.YoutubePlaylistParser).extractPlaylistId(#request.playlistUrl())",
            unless = "#result.videoNotes().?[chapterAvailability() == T(com.timesync.notes.entity.ChapterAvailability).TEMPORARILY_UNAVAILABLE].size() > 0"
    )
    public PlaylistTranscriptResponse extractPlaylist(ExtractPlaylistRequest request) {
        String playlistId = YoutubePlaylistParser.extractPlaylistId(request.playlistUrl());
        log.info("Executing bounded extraction on playlist ID: {}", playlistId);

        YoutubeDataApiService.PlaylistMetadata metadata = youtubeDataApiService.getPlaylistMetadata(playlistId);
        YoutubeDataApiService.PlaylistVideoCollection collection =
                youtubeDataApiService.getPlaylistVideoIds(playlistId);
        List<String> videoIds = collection.videoIds();

        List<TranscriptResponse> processedNotes = new ArrayList<>();
        List<PlaylistItemFailure> failures = new ArrayList<>();
        int attemptedVideos = 0;
        int skippedVideos = 0;
        boolean stoppedEarly = false;

        for (int i = 0; i < videoIds.size(); i += batchSize) {
            List<String> batch = videoIds.subList(i, Math.min(i + batchSize, videoIds.size()));
            int failuresBeforeBatch = failures.size();
            attemptedVideos += batch.size();
            log.info(
                    "Processing playlist {} batch {}/{} ({} video(s))",
                    playlistId,
                    i / batchSize + 1,
                    (videoIds.size() + batchSize - 1) / batchSize,
                    batch.size()
            );
            Map<String, String> loggingContext = MDC.getCopyOfContextMap();
            List<Callable<PlaylistVideoResult>> tasks = batch.stream()
                    .map(videoId -> (Callable<PlaylistVideoResult>) () -> {
                        Map<String, String> previousContext = MDC.getCopyOfContextMap();
                        try {
                            if (loggingContext == null) {
                                MDC.clear();
                            } else {
                                MDC.setContextMap(loggingContext);
                            }
                            return processPlaylistVideo(videoId, playlistId);
                        } finally {
                            if (previousContext == null) {
                                MDC.clear();
                            } else {
                                MDC.setContextMap(previousContext);
                            }
                        }
                    })
                    .toList();

            try {
                List<Future<PlaylistVideoResult>> futures = playlistBatchExecutor.invokeAll(
                        tasks,
                        batchTimeoutSeconds,
                        TimeUnit.SECONDS
                );

                for (int index = 0; index < futures.size(); index++) {
                    String videoId = batch.get(index);
                    Future<PlaylistVideoResult> future = futures.get(index);
                    if (future.isCancelled()) {
                        failures.add(new PlaylistItemFailure(
                                videoId,
                                "PROCESSING_TIMEOUT",
                                "Video processing exceeded the configured batch timeout."
                        ));
                        continue;
                    }

                    try {
                        PlaylistVideoResult result = future.get();
                        if (result.response() != null) {
                            processedNotes.add(result.response());
                        } else if (result.failure() != null) {
                            failures.add(result.failure());
                        }
                    } catch (CancellationException ex) {
                        failures.add(new PlaylistItemFailure(
                                videoId,
                                "PROCESSING_TIMEOUT",
                                "Video processing was cancelled after the batch timeout."
                        ));
                    } catch (Exception ex) {
                        failures.add(failure(videoId, ex));
                    }
                }
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                log.error("Playlist batch execution was interrupted for playlist {}", playlistId, ex);
                for (String videoId : batch) {
                    failures.add(new PlaylistItemFailure(
                            videoId,
                            "PROCESSING_INTERRUPTED",
                            "Playlist processing was interrupted."
                    ));
                }
                break;
            }

            List<PlaylistItemFailure> batchFailures = failures.subList(
                    failuresBeforeBatch,
                    failures.size()
            );
            boolean batchWasRateLimited = !batchFailures.isEmpty()
                    && batchFailures.size() == batch.size()
                    && batchFailures.stream().allMatch(this::isYoutubeRateLimit);

            if (batchWasRateLimited) {
                int nextIndex = i + batch.size();
                List<String> remainingVideoIds = videoIds.subList(nextIndex, videoIds.size());
                skippedVideos = remainingVideoIds.size();
                for (String videoId : remainingVideoIds) {
                    failures.add(new PlaylistItemFailure(
                            videoId,
                            "SKIPPED_UPSTREAM_RATE_LIMIT",
                            "Skipped because YouTube rate limiting persisted for the current playlist batch."
                    ));
                }
                stoppedEarly = skippedVideos > 0;
                log.warn(
                        "Stopping playlist {} after a fully rate-limited batch; skipped {} remaining video(s)",
                        playlistId,
                        skippedVideos
                );
                break;
            }
        }

        if (processedNotes.isEmpty()) {
            if (failures.stream().anyMatch(this::isYoutubeRateLimit)) {
                throw new UpstreamRateLimitException(
                        "YouTube rate limiting prevented playlist processing. Retry after the indicated delay.",
                        Math.max(1, Math.max(
                                youtubeAvailabilityGuard.getRetryAfterSeconds(YoutubeAvailabilityScope.DATA_API),
                                Math.max(youtubeAvailabilityGuard.getRetryAfterSeconds(YoutubeAvailabilityScope.WATCH_PAGE),
                                        youtubeAvailabilityGuard.getRetryAfterSeconds(YoutubeAvailabilityScope.CAPTION))))
                );
            }
            if (failures.stream().anyMatch(failure -> "YOUTUBE_BUSY".equals(failure.code()))) {
                throw new com.timesync.notes.exception.YoutubeBusyException(
                        "YouTube request capacity prevented playlist processing. Please try again shortly.");
            }
            if (failures.stream().allMatch(failure -> "CAPTIONS_UNAVAILABLE".equals(failure.code()))) {
                throw new ApiException(
                        "No videos in this playlist provide accessible captions.",
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "PLAYLIST_CAPTIONS_UNAVAILABLE"
                );
            }
            if (failures.stream().allMatch(failure -> "NON_EDUCATIONAL_CONTENT".equals(failure.code()))) {
                throw new ApiException(
                        "No videos in this playlist passed the educational-content filter.",
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "PLAYLIST_NON_EDUCATIONAL_CONTENT"
                );
            }
            throw new ApiException(
                    "No videos in playlist '" + playlistId + "' could be processed. " +
                            summarizeFailures(failures),
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "PLAYLIST_NO_PROCESSABLE_VIDEOS"
            );
        }

        return PlaylistTranscriptResponse.builder()
                .playlistId(playlistId)
                .playlistTitle(metadata.title())
                .playlistThumbnailUrl(metadata.thumbnailUrl())
                .totalVideos(collection.totalAvailable())
                .attemptedVideos(attemptedVideos)
                .processedVideos(processedNotes.size())
                .captionVideos((int) processedNotes.stream()
                        .filter(note -> note.noteSource() == NoteSource.CAPTIONS)
                        .count())
                .metadataVideos((int) processedNotes.stream()
                        .filter(note -> note.noteSource() == NoteSource.METADATA)
                        .count())
                .temporarilyUnavailableVideos((int) processedNotes.stream()
                        .filter(note -> note.transcriptAvailability() == TranscriptAvailability.TEMPORARILY_UNAVAILABLE)
                        .count())
                .failedVideos(failures.size())
                .skippedVideos(skippedVideos)
                .videoNotes(List.copyOf(processedNotes))
                .failures(List.copyOf(failures))
                .truncated(collection.truncated())
                .stoppedEarly(stoppedEarly)
                .maxVideos(maxPlaylistVideos)
                .cachedResponse(false)
                .build();
    }

    private PlaylistVideoResult processPlaylistVideo(
            String videoId,
            String playlistId) {
        try {
            ExtractVideoRequest videoRequest = new ExtractVideoRequest(
                    "https://www.youtube.com/watch?v=" + videoId);
            return new PlaylistVideoResult(
                    transcriptCleaningService.extractAndProcess(videoRequest),
                    null
            );
        } catch (Exception ex) {
            PlaylistItemFailure itemFailure = failure(videoId, ex);
            log.warn(
                    "Skipping video {} in playlist {}. Code: {}. Cause: {}",
                    videoId,
                    playlistId,
                    itemFailure.code(),
                    ex.getClass().getSimpleName()
            );
            return new PlaylistVideoResult(null, itemFailure);
        }
    }

    private PlaylistItemFailure failure(String videoId, Exception ex) {
        ApiException apiException = findApiException(ex);
        String code = apiException != null
                ? apiException.getErrorCode()
                : "VIDEO_PROCESSING_FAILED";
        String message = apiException == null || apiException.getMessage() == null || apiException.getMessage().isBlank()
                ? "Video processing failed."
                : apiException.getMessage();
        if (message.length() > 300) {
            message = message.substring(0, 300);
        }
        return new PlaylistItemFailure(videoId, code, message);
    }

    private boolean isYoutubeRateLimit(PlaylistItemFailure failure) {
        return "YOUTUBE_RATE_LIMITED".equals(failure.code());
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

    private String summarizeFailures(List<PlaylistItemFailure> failures) {
        if (failures.isEmpty()) {
            return "No detailed failure information was available.";
        }
        return failures.stream()
                .limit(3)
                .map(failure -> failure.videoId() + ": " + failure.code())
                .reduce((left, right) -> left + "; " + right)
                .orElse("Video processing failed.");
    }

    private record PlaylistVideoResult(
            TranscriptResponse response,
            PlaylistItemFailure failure
    ) {
    }
}
