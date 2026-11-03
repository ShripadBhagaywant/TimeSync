package com.timesync.notes.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timesync.notes.exception.RateLimitExceededException;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String EXTRACTION_PREFIX = "/api/v1/extract";
    private static final String SHARE_SNAPSHOT_PATH = "/api/v1/notes/share";

    private final LettuceBasedProxyManager<String> proxyManager;
    private final ObjectMapper objectMapper;
    private final int perMinuteCapacity;
    private final int dailyCapacity;
    private final boolean trustForwardedHeaders;
    private final LocalRateLimitBuckets localFallbackBuckets;

    public RateLimitFilter(
            LettuceBasedProxyManager<String> proxyManager,
            ObjectMapper objectMapper,
            @Value("${app.rate-limit.per-minute:20}") int perMinuteCapacity,
            @Value("${app.rate-limit.per-day:200}") int dailyCapacity,
            @Value("${app.rate-limit.trust-forwarded-headers:false}") boolean trustForwardedHeaders) {
        this.proxyManager = proxyManager;
        this.objectMapper = objectMapper;
        this.perMinuteCapacity = Math.max(1, perMinuteCapacity);
        this.dailyCapacity = Math.max(this.perMinuteCapacity, dailyCapacity);
        this.trustForwardedHeaders = trustForwardedHeaders;
        this.localFallbackBuckets = new LocalRateLimitBuckets(10_000, System::nanoTime, this::localFallbackBucket);
    }

    private Supplier<BucketConfiguration> combinedLimitSupplier() {
        return () -> BucketConfiguration.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(perMinuteCapacity)
                        .refillGreedy(perMinuteCapacity, Duration.ofMinutes(1))
                        .build())
                .addLimit(Bandwidth.builder()
                        .capacity(dailyCapacity)
                        .refillGreedy(dailyCapacity, Duration.ofDays(1))
                        .build())
                .build();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;

        String uri = request.getRequestURI();
        boolean jobPoll = "GET".equalsIgnoreCase(request.getMethod())
                && (uri.startsWith("/api/v1/extract/playlist/jobs/")
                || uri.startsWith("/api/v1/extract/ai/jobs/"));
        if (jobPoll) return true;

        boolean extractionRequest = uri.startsWith(EXTRACTION_PREFIX);
        boolean shareSnapshotWrite = "POST".equalsIgnoreCase(request.getMethod())
                && SHARE_SNAPSHOT_PATH.equals(uri);
        return !extractionRequest && !shareSnapshotWrite;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String clientKey = getClientIdentifier(request);
        int tokensToConsume = request.getRequestURI().contains("/playlist") ? 5 : 1;
        ConsumptionProbe probe;
        try {
            Bucket distributedBucket = proxyManager.builder().build(
                    "api:" + clientKey,
                    combinedLimitSupplier()
            );
            probe = distributedBucket.tryConsumeAndReturnRemaining(tokensToConsume);
        } catch (RuntimeException ex) {
            log.warn("Distributed rate limiter unavailable; using local fallback. errorType={}", ex.getClass().getSimpleName());
            Bucket localBucket = localFallbackBuckets.get(clientKey);
            probe = localBucket.tryConsumeAndReturnRemaining(tokensToConsume);
        }

        if (!probe.isConsumed()) {
            long retryAfterSeconds = Math.max(
                    1,
                    Duration.ofNanos(probe.getNanosToWaitForRefill()).toSeconds()
            );
            log.warn("Extraction rate limit reached. retryAfterSeconds={}", retryAfterSeconds);
            writeProblemDetailResponse(response, retryAfterSeconds);
            return;
        }

        response.setHeader("X-RateLimit-Remaining", Long.toString(probe.getRemainingTokens()));
        filterChain.doFilter(request, response);
    }

    private Bucket localFallbackBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(perMinuteCapacity)
                        .refillGreedy(perMinuteCapacity, Duration.ofMinutes(1))
                        .build())
                .addLimit(Bandwidth.builder()
                        .capacity(dailyCapacity)
                        .refillGreedy(dailyCapacity, Duration.ofDays(1))
                        .build())
                .build();
    }

    private void writeProblemDetailResponse(
            HttpServletResponse response,
            long retryAfterSeconds) throws IOException {
        RateLimitExceededException exception = new RateLimitExceededException(
                "Extraction limit exceeded. Retry after " + retryAfterSeconds + " seconds."
        );
        String traceId = Optional.ofNullable(MDC.get("traceId"))
                .orElseGet(() -> UUID.randomUUID().toString().substring(0, 8));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "https://timesync.com/errors/rate_limit_exceeded");
        body.put("title", exception.getErrorCode());
        body.put("code", exception.getErrorCode());
        body.put("status", exception.getStatus().value());
        body.put("detail", exception.getMessage());
        body.put("timestamp", Instant.now().toString());
        body.put("traceId", traceId);

        response.setStatus(exception.getStatus().value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
        response.setHeader("X-RateLimit-Remaining", "0");
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }

    private String getClientIdentifier(HttpServletRequest request) {
        if (trustForwardedHeaders) {
            String forwardedFor = request.getHeader("X-Forwarded-For");
            if (forwardedFor != null && !forwardedFor.isBlank()) {
                return "ip:" + forwardedFor.split(",")[0].trim();
            }
        }
        return "ip:" + request.getRemoteAddr();
    }
}
