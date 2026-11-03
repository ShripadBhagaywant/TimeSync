package com.timesync.notes.integration.youtube;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class YoutubePlayerResponseClient {

    private static final String BROWSER_USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

    private final RestClient restClient;
    private final String watchBaseUrl;

    public YoutubePlayerResponseClient(
            @Qualifier("youtubeContentRestClient") RestClient restClient,
            @Value("${app.youtube.watch-base-url:https://www.youtube.com/watch}") String watchBaseUrl) {
        this.restClient = restClient;
        this.watchBaseUrl = watchBaseUrl;
    }

    @Cacheable(
            value = "youtubePlayerResponses",
            key = "'v1:' + #videoId",
            unless = "#result == null || #result.isBlank()"
    )
    public String getPlayerResponseJson(String videoId) {
        return getPlayerResponseJson(videoId, YoutubeContentOperation.WATCH_PAGE);
    }

    @Cacheable(value = "youtubePlayerResponses", key = "'v1:' + #videoId",
            unless = "#result == null || #result.isBlank()")
    public String getPlayerResponseJson(String videoId, YoutubeContentOperation operation) {
        var data = readWatchPageData(videoId, operation);
        return data.initialPlayerResponse() == null ? "" : data.initialPlayerResponse().toString();
    }

    public record WatchPageData(com.fasterxml.jackson.databind.JsonNode initialPlayerResponse,
                                com.fasterxml.jackson.databind.JsonNode initialData, boolean malformed) { }

    public WatchPageData readWatchPageData(String videoId, YoutubeContentOperation operation) {
        String html = YoutubeContentRequestContext.with(operation, videoId, () -> restClient.get()
                .uri(watchBaseUrl + "?v=" + videoId + "&hl=en")
                .header(HttpHeaders.USER_AGENT, BROWSER_USER_AGENT)
                .header(HttpHeaders.ACCEPT_LANGUAGE, "en-US,en;q=0.9")
                .retrieve().body(String.class));
        return parseWatchPage(html);
    }

    static WatchPageData parseWatchPage(String html) {
        com.fasterxml.jackson.databind.JsonNode player = null;
        com.fasterxml.jackson.databind.JsonNode initial = null;
        boolean malformed = false;
        try { player = readInitialJson(html, "ytInitialPlayerResponse"); }
        catch (IllegalArgumentException ignored) { malformed = true; }
        try { initial = readInitialJson(html, "ytInitialData"); }
        catch (IllegalArgumentException ignored) { malformed = true; }
        return new WatchPageData(player, initial, malformed);
    }

    private static com.fasterxml.jackson.databind.JsonNode readInitialJson(String html, String name) {
        if (html == null || html.isBlank()) return null;
        var pattern = java.util.regex.Pattern.compile(
                "(?:\\b" + name + "|window\\s*\\[\\s*[\"']" + name + "[\"']\\s*\\])\\s*=\\s*(?=\\{)");
        var matcher = pattern.matcher(html);
        boolean malformed = false;
        while (matcher.find()) {
            String json = extractBalancedJsonObject(html, matcher.end());
            try {
                if (json != null) return new com.fasterxml.jackson.databind.ObjectMapper().readTree(json);
            } catch (com.fasterxml.jackson.core.JsonProcessingException ignored) {
                // Parser messages can contain signed URLs; never expose them.
            }
            malformed = true;
        }
        if (malformed) throw new IllegalArgumentException("Malformed watch-page JSON");
        return null;
    }

    private static String extractBalancedJsonObject(String source, int start) {
        if (start < 0 || start >= source.length() || source.charAt(start) != '{') {
            return null;
        }

        int depth = 0;
        boolean inString = false;
        boolean escaped = false;
        for (int index = start; index < source.length(); index++) {
            char current = source.charAt(index);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (current == '\\') {
                    escaped = true;
                } else if (current == '"') {
                    inString = false;
                }
                continue;
            }

            if (current == '"') {
                inString = true;
            } else if (current == '{') {
                depth++;
            } else if (current == '}') {
                depth--;
                if (depth == 0) {
                    return source.substring(start, index + 1);
                }
            }
        }
        return null;
    }
}
