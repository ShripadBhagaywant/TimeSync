package com.timesync.notes.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.timesync.notes.exception.ApiException;
import com.timesync.notes.exception.UnprocessableVideoException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service

public class YoutubeDataApiService {

    private final RestClient restClient;

    public YoutubeDataApiService(@Qualifier("youtubeDataApiRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    @Value("${app.api-keys.youtube}")
    private String apiKey;

    @Value("${app.youtube.data-api-base-url}")
    private String baseUrl;

    @Value("${app.youtube.max-playlist-videos:250}")
    private int maxPlaylistVideos;

    @Cacheable(value = "youtubeVideoMetadata", key = "'v2:' + #videoId", unless = "#result == null")
    @Retryable(
            retryFor = {ResourceAccessException.class, HttpServerErrorException.class},
            maxAttemptsExpression = "${app.youtube.retry.max-attempts:3}",
            backoff = @Backoff(
                    delayExpression = "${app.youtube.retry.initial-delay-ms:1000}",
                    multiplierExpression = "${app.youtube.retry.multiplier:2.0}",
                    maxDelayExpression = "${app.youtube.retry.max-delay-ms:8000}"
            )
    )
    public VideoMetadata getVideoMetadata(String videoId) {
        JsonNode root = get("videos", "snippet,contentDetails", "id", videoId);
        JsonNode items = root.path("items");

        if (!items.isArray() || items.isEmpty()) {
            throw new UnprocessableVideoException(
                    "YouTube video was not found or is not publicly accessible.",
                    "VIDEO_NOT_FOUND"
            );
        }

        JsonNode item = items.get(0);
        JsonNode snippet = item.path("snippet");
        JsonNode contentDetails = item.path("contentDetails");

        return new VideoMetadata(
                textOrDefault(snippet.path("title"), "YouTube Video"),
                textOrDefault(snippet.path("channelTitle"), "YouTube Channel"),
                textOrDefault(contentDetails.path("duration"), "N/A"),
                textOrDefault(snippet.path("categoryId"), ""),
                textOrDefault(snippet.path("description"), ""),
                stringList(snippet.path("tags"))
        );
    }

    @Cacheable(value = "youtubePlaylistMetadata", key = "#playlistId", unless = "#result == null")
    @Retryable(
            retryFor = {ResourceAccessException.class, HttpServerErrorException.class},
            maxAttemptsExpression = "${app.youtube.retry.max-attempts:3}",
            backoff = @Backoff(
                    delayExpression = "${app.youtube.retry.initial-delay-ms:1000}",
                    multiplierExpression = "${app.youtube.retry.multiplier:2.0}",
                    maxDelayExpression = "${app.youtube.retry.max-delay-ms:8000}"
            )
    )
    public PlaylistMetadata getPlaylistMetadata(String playlistId) {
        JsonNode root = get("playlists", "snippet", "id", playlistId);
        JsonNode items = root.path("items");

        if (!items.isArray() || items.isEmpty()) {
            throw new UnprocessableVideoException(
                    "YouTube playlist was not found or is not publicly accessible.",
                    "PLAYLIST_NOT_FOUND"
            );
        }

        JsonNode snippet = items.get(0).path("snippet");

        return new PlaylistMetadata(
                textOrDefault(snippet.path("title"), "YouTube Playlist"),
                firstThumbnail(snippet.path("thumbnails"))
        );
    }

    @Cacheable(
            value = "youtubePlaylistVideoIds",
            key = "'v2:' + #playlistId",
            unless = "#result == null || #result.videoIds().isEmpty()"
    )
    @Retryable(
            retryFor = {ResourceAccessException.class, HttpServerErrorException.class},
            maxAttemptsExpression = "${app.youtube.retry.max-attempts:3}",
            backoff = @Backoff(
                    delayExpression = "${app.youtube.retry.initial-delay-ms:1000}",
                    multiplierExpression = "${app.youtube.retry.multiplier:2.0}",
                    maxDelayExpression = "${app.youtube.retry.max-delay-ms:8000}"
            )
    )
    public PlaylistVideoCollection getPlaylistVideoIds(String playlistId) {
        List<String> videoIds = new ArrayList<>();
        String pageToken = null;
        int totalAvailable = 0;

        while (videoIds.size() < maxPlaylistVideos) {
            UriComponentsBuilder builder = UriComponentsBuilder
                    .fromHttpUrl(baseUrl + "/playlistItems")
                    .queryParam("part", "contentDetails")
                    .queryParam("playlistId", playlistId)
                    .queryParam("maxResults", Math.min(50, maxPlaylistVideos - videoIds.size()))
                    .queryParam("key", apiKey);

            if (pageToken != null && !pageToken.isBlank()) {
                builder.queryParam("pageToken", pageToken);
            }

            JsonNode root = restClient.get()
                    .uri(builder.build(true).toUri())
                    .retrieve()
                    .body(JsonNode.class);

            if (root == null) {
                break;
            }

            if (totalAvailable == 0) {
                totalAvailable = root.path("pageInfo").path("totalResults").asInt(0);
            }

            JsonNode items = root.path("items");
            if (items.isArray()) {
                for (JsonNode item : items) {
                    if (videoIds.size() >= maxPlaylistVideos) {
                        break;
                    }

                    String videoId = item.path("contentDetails").path("videoId").asText("").trim();
                    if (!videoId.isBlank() && !videoIds.contains(videoId)) {
                        videoIds.add(videoId);
                    }
                }
            }

            String nextPageToken = root.path("nextPageToken").asText("").trim();
            if (nextPageToken.isBlank() || !items.isArray() || items.isEmpty()) {
                break;
            }
            pageToken = nextPageToken;
        }

        if (videoIds.isEmpty()) {
            throw new UnprocessableVideoException(
                    "The playlist contains no accessible videos.",
                    "PLAYLIST_EMPTY"
            );
        }

        int normalizedTotal = Math.max(totalAvailable, videoIds.size());
        return new PlaylistVideoCollection(
                List.copyOf(videoIds),
                normalizedTotal,
                normalizedTotal > videoIds.size()
        );
    }

    private JsonNode get(String resource, String part, String queryName, String queryValue) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ApiException(
                    "YouTube API key is not configured.",
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "YOUTUBE_API_KEY_MISSING"
            );
        }

        JsonNode root = restClient.get()
                .uri(UriComponentsBuilder
                        .fromHttpUrl(baseUrl + "/" + resource)
                        .queryParam("part", part)
                        .queryParam(queryName, queryValue)
                        .queryParam("key", apiKey)
                        .build(true)
                        .toUri())
                .retrieve()
                .body(JsonNode.class);

        if (root == null) {
            throw new ApiException(
                    "YouTube Data API returned an empty response.",
                    HttpStatus.BAD_GATEWAY,
                    "YOUTUBE_EMPTY_RESPONSE"
            );
        }

        return root;
    }

    private static String textOrDefault(JsonNode node, String fallback) {
        String value = node.asText("").trim();
        return value.isBlank() ? fallback : value;
    }

    private static String firstThumbnail(JsonNode thumbnails) {
        for (String key : List.of("maxres", "standard", "high", "medium", "default")) {
            String url = thumbnails.path(key).path("url").asText("").trim();
            if (!url.isBlank()) {
                return url;
            }
        }
        return "";
    }

    private static List<String> stringList(JsonNode values) {
        if (!values.isArray()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (JsonNode value : values) {
            String text = value.asText("").trim();
            if (!text.isBlank()) {
                result.add(text);
            }
        }
        return List.copyOf(result);
    }

    public record VideoMetadata(
            String title,
            String channelName,
            String durationIso8601,
            String categoryId,
            String description,
            List<String> tags) {
        public String formattedDuration() {
            if (durationIso8601 == null || durationIso8601.isBlank() || "N/A".equals(durationIso8601)) {
                return "N/A";
            }

            try {
                Duration duration = Duration.parse(durationIso8601);
                long hours = duration.toHours();
                long minutes = duration.toMinutesPart();
                long seconds = duration.toSecondsPart();

                return hours > 0
                        ? "%02d:%02d:%02d".formatted(hours, minutes, seconds)
                        : "%02d:%02d".formatted(minutes, seconds);
            } catch (Exception ignored) {
                return durationIso8601;
            }
        }
    }

    public record PlaylistMetadata(String title, String thumbnailUrl) {
    }

    public record PlaylistVideoCollection(
            List<String> videoIds,
            int totalAvailable,
            boolean truncated
    ) {
    }
}
