package com.timesync.notes.config;

import com.timesync.notes.exception.UnprocessableVideoException;
import com.timesync.notes.integration.youtube.YoutubeAvailabilityGuard;
import com.timesync.notes.integration.youtube.YoutubeAvailabilityScope;
import com.timesync.notes.integration.youtube.YoutubeConcurrencyLimiter;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.core5.util.Timeout;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Slf4j
@Configuration
public class RestClientConfig {

    private static final int MAX_REDIRECTS = 5;
    private static final int RESPONSE_TIMEOUT_SECONDS = 20;

    @Bean
    public RestClient youtubeDataApiRestClient(YoutubeAvailabilityGuard guard, YoutubeConcurrencyLimiter limiter) {
        return restClient(guard, YoutubeAvailabilityScope.DATA_API, limiter);
    }

    @Bean
    public RestClient youtubeContentRestClient(YoutubeAvailabilityGuard guard, YoutubeConcurrencyLimiter limiter) {
        return restClient(guard, YoutubeAvailabilityScope.CAPTION, limiter);
    }

    public RestClient restClient(YoutubeAvailabilityGuard guard) {
        return restClient(guard, YoutubeAvailabilityScope.CAPTION);
    }

    public RestClient restClient(YoutubeAvailabilityGuard guard, YoutubeAvailabilityScope scope) {
        return restClient(guard, scope, new YoutubeConcurrencyLimiter(3, 5000));
    }

    public RestClient restClient(YoutubeAvailabilityGuard youtubeAvailabilityGuard, YoutubeAvailabilityScope scope,
            YoutubeConcurrencyLimiter limiter) {
        // High-throughput connection manager for handling concurrent batch processing
        PoolingHttpClientConnectionManager connectionManager = new PoolingHttpClientConnectionManager();
        connectionManager.setMaxTotal(100);
        connectionManager.setDefaultMaxPerRoute(20);

        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectionRequestTimeout(Timeout.ofSeconds(5))
                .setResponseTimeout(Timeout.ofSeconds(RESPONSE_TIMEOUT_SECONDS))
                .setMaxRedirects(MAX_REDIRECTS)
                .build();

        CloseableHttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connectionManager)
                .setDefaultRequestConfig(requestConfig)
                // Every upstream call is independent. Sharing cookies between YouTube
                // requests can create consent/region redirect loops across users.
                .disableCookieManagement()
                // Spring Retry owns the retry policy and backoff for these calls.
                .disableAutomaticRetries()
                .build();

        HttpComponentsClientHttpRequestFactory requestFactory = new HttpComponentsClientHttpRequestFactory(httpClient);
        requestFactory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        requestFactory.setConnectionRequestTimeout((int) Duration.ofSeconds(5).toMillis());

        return RestClient.builder()
                .requestFactory(requestFactory)
                // This client is used exclusively by the three YouTube-bound services.
                // Gemini has its own builder in SpringAiConfig.
                .requestInterceptor((request, body, execution) ->
                        limiter.execute(youtubeAvailabilityGuard, scope, request, body, execution))
                .defaultStatusHandler(
                        status -> status.is4xxClientError(),
                        (request, response) -> {
                            int statusCode = response.getStatusCode().value();
                            if (statusCode == 403 || statusCode == 401) {
                                throw new UnprocessableVideoException("Access denied: Video is private, paid, or members-only.", "MEMBERS_ONLY_VIDEO");
                            } else if (statusCode == 404) {
                                throw new UnprocessableVideoException("Requested YouTube resource or video was not found.", "VIDEO_NOT_FOUND");
                            }
                            throw new HttpClientErrorException(response.getStatusCode(), response.getStatusText());
                        }
                )
                .defaultStatusHandler(
                        status -> status.is5xxServerError(),
                        (request, response) -> {
                            log.error("Upstream server error encountered: HTTP {}", response.getStatusCode());
                            throw new HttpServerErrorException(response.getStatusCode(), "Upstream service error from YouTube/external endpoint.");
                        }
                )
                .build();
    }
}
