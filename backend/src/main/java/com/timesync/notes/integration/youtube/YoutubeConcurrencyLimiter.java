package com.timesync.notes.integration.youtube;

import com.timesync.notes.exception.YoutubeBusyException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRequest;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/** One process-local budget shared by both YouTube clients, independent of the connection pool. */
@Slf4j
@Component
public class YoutubeConcurrencyLimiter {
    private final Semaphore permits;
    private final long waitTimeoutMillis;

    public YoutubeConcurrencyLimiter(
            @Value("${app.youtube.concurrency.max-concurrent-requests:${YOUTUBE_MAX_CONCURRENT_REQUESTS:3}}") int maximum,
            @Value("${app.youtube.concurrency.permit-wait-timeout-ms:${YOUTUBE_PERMIT_WAIT_TIMEOUT_MS:5000}}") long waitTimeoutMillis) {
        if (maximum < 1 || waitTimeoutMillis < 0) {
            throw new IllegalArgumentException("YouTube concurrency must be >= 1 and permit wait must be >= 0");
        }
        this.permits = new Semaphore(maximum, true);
        this.waitTimeoutMillis = waitTimeoutMillis;
    }

    public ClientHttpResponse execute(YoutubeAvailabilityGuard guard, YoutubeAvailabilityScope scope,
            HttpRequest request, byte[] body, ClientHttpRequestExecution execution) throws IOException {
        var context = YoutubeContentRequestContext.current();
        if (scope != YoutubeAvailabilityScope.DATA_API && context.operation() != null) {
            scope = context.operation().scope();
        }
        guard.checkAllowed(scope);
        try {
            if (!permits.tryAcquire(waitTimeoutMillis, TimeUnit.MILLISECONDS)) {
                log.warn("YouTube outbound capacity exhausted after {} ms.", waitTimeoutMillis);
                throw new YoutubeBusyException("YouTube requests are busy. Please try again shortly.");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new YoutubeBusyException("Interrupted while waiting for YouTube request capacity.");
        }
        try {
            guard.checkAllowed(scope);
            boolean content = scope != YoutubeAvailabilityScope.DATA_API;

            String host = request == null || request.getURI().getHost() == null ? "unknown" : request.getURI().getHost();
            long started = System.nanoTime();
            Integer responseStatus = null;
            if (content) log.debug("YouTube CONTENT request starting. operation={}, host={}, videoId={}, scope={}",
                    context.operation(), host, context.videoId(), scope);
            try (ClientHttpResponse response = execution.execute(request, body)) {
                HttpStatusCode status = response.getStatusCode();
                responseStatus = status.value();
                if (status.value() == 429) {
                    if (content) log.warn("YouTube CONTENT request rate-limited. operation={}, host={}, status=429, videoId={}, scope={}",
                            context.operation(), host, context.videoId(), scope);
                    throw guard.recordRateLimit(scope, content ? context.operation() : null);
                }
                if (content && status.is5xxServerError()) {
                    log.warn("YouTube CONTENT request failed upstream. operation={}, host={}, status={}, videoId={}, scope={}",
                            context.operation(), host, status.value(), context.videoId(), scope);
                }
                // Consume the body before releasing: headers alone do not finish an HTTP operation.
                byte[] bytes = response.getBody().readAllBytes();
                HttpHeaders headers = new HttpHeaders();
                headers.putAll(response.getHeaders());
                String statusText = response.getStatusText();
                if (status.is2xxSuccessful()) guard.recordSuccess(scope);
                return new BufferedResponse(status, statusText, HttpHeaders.readOnlyHttpHeaders(headers), bytes);
            } catch (IOException failure) {
                if (content) log.warn("YouTube CONTENT request network failure. operation={}, host={}, videoId={}, scope={}, error={}",
                        context.operation(), host, context.videoId(), scope, failure.getClass().getSimpleName());
                throw failure;
            } finally {
                if (content) log.debug("YouTube CONTENT request completed. operation={}, status={}, durationMs={}, videoId={}",
                        context.operation(), responseStatus, TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started), context.videoId());
            }
        } finally {
            permits.release();
        }
    }

    int availablePermits() { return permits.availablePermits(); }
    int queuedRequests() { return permits.getQueueLength(); }

    private record BufferedResponse(HttpStatusCode status, String statusText, HttpHeaders headers, byte[] bytes)
            implements ClientHttpResponse {
        @Override public HttpStatusCode getStatusCode() { return status; }
        @Override public String getStatusText() { return statusText; }
        @Override public HttpHeaders getHeaders() { return headers; }
        @Override public InputStream getBody() { return new ByteArrayInputStream(bytes); }
        @Override public void close() { }
    }
}