package com.timesync.notes.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class RateLimitFilterTest {

    @Test
    void playlistJobPollingDoesNotConsumeExtractionTokens() {
        RateLimitFilter filter = filter(20, 200);
        MockHttpServletRequest poll = new MockHttpServletRequest(
                "GET",
                "/api/v1/extract/playlist/jobs/123e4567-e89b-42d3-a456-426614174000"
        );
        MockHttpServletRequest submit = new MockHttpServletRequest(
                "POST",
                "/api/v1/extract/playlist/jobs"
        );
        MockHttpServletRequest aiPoll = new MockHttpServletRequest(
                "GET",
                "/api/v1/extract/ai/jobs/123e4567-e89b-42d3-a456-426614174000"
        );

        assertTrue(filter.shouldNotFilter(poll));
        assertTrue(filter.shouldNotFilter(aiPoll));
        assertFalse(filter.shouldNotFilter(submit));
    }

    @Test
    void localFallbackStillEnforcesLimitWhenRedisFails() throws Exception {
        LettuceBasedProxyManager<String> proxyManager = mock(LettuceBasedProxyManager.class);
        doThrow(new IllegalStateException("redis unavailable")).when(proxyManager).builder();
        RateLimitFilter filter = new RateLimitFilter(proxyManager, new ObjectMapper(), 2, 2, false);
        FilterChain chain = mock(FilterChain.class);

        for (int attempt = 0; attempt < 3; attempt++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/extract/video");
            request.setRemoteAddr("127.0.0.1");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilterInternal(request, response, chain);
            if (attempt < 2) {
                assertEquals(200, response.getStatus());
            } else {
                assertEquals(429, response.getStatus());
                assertEquals("0", response.getHeader("X-RateLimit-Remaining"));
                assertTrue(Long.parseLong(response.getHeader("Retry-After")) >= 1);
                assertTrue(response.getContentType().startsWith("application/problem+json"));
                assertEquals("RATE_LIMIT_EXCEEDED", new ObjectMapper()
                        .readTree(response.getContentAsString())
                        .path("code")
                        .asText());
            }
        }
        verify(chain, times(2)).doFilter(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void playlistSubmissionConsumesFiveTokens() throws Exception {
        RateLimitFilter filter = failingRedisFilter(6, 6, false);
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse first = invoke(filter, chain, "POST", "/api/v1/extract/playlist/jobs", "10.0.0.1", null);
        MockHttpServletResponse second = invoke(filter, chain, "POST", "/api/v1/extract/video", "10.0.0.1", null);
        MockHttpServletResponse third = invoke(filter, chain, "POST", "/api/v1/extract/video", "10.0.0.1", null);

        assertEquals(200, first.getStatus());
        assertEquals("1", first.getHeader("X-RateLimit-Remaining"));
        assertEquals(200, second.getStatus());
        assertEquals(429, third.getStatus());
    }

    @Test
    void snapshotWritesAreLimitedButSharedNoteReadsAreNot() {
        RateLimitFilter filter = filter(20, 200);
        MockHttpServletRequest create = new MockHttpServletRequest("POST", "/api/v1/notes/share");
        MockHttpServletRequest read = new MockHttpServletRequest("GET", "/api/v1/notes/abc123");

        assertFalse(filter.shouldNotFilter(create));
        assertTrue(filter.shouldNotFilter(read));
    }

    @Test
    void clientsHaveIndependentFallbackBucketsAndForwardedIpIsTrustedOnlyWhenEnabled() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        RateLimitFilter directIpFilter = failingRedisFilter(1, 1, false);

        assertEquals(200, invoke(directIpFilter, chain, "POST", "/api/v1/extract/video", "10.0.0.1", "203.0.113.9").getStatus());
        assertEquals(429, invoke(directIpFilter, chain, "POST", "/api/v1/extract/video", "10.0.0.1", "203.0.113.10").getStatus());
        assertEquals(200, invoke(directIpFilter, chain, "POST", "/api/v1/extract/video", "10.0.0.2", null).getStatus());

        RateLimitFilter proxyAwareFilter = failingRedisFilter(1, 1, true);
        assertEquals(200, invoke(proxyAwareFilter, chain, "POST", "/api/v1/extract/video", "10.0.0.1", "203.0.113.9").getStatus());
        assertEquals(200, invoke(proxyAwareFilter, chain, "POST", "/api/v1/extract/video", "10.0.0.1", "203.0.113.10").getStatus());
    }

    private MockHttpServletResponse invoke(
            RateLimitFilter filter,
            FilterChain chain,
            String method,
            String uri,
            String remoteAddress,
            String forwardedFor) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRemoteAddr(remoteAddress);
        if (forwardedFor != null) request.addHeader("X-Forwarded-For", forwardedFor);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilterInternal(request, response, chain);
        return response;
    }

    @SuppressWarnings("unchecked")
    private RateLimitFilter failingRedisFilter(int perMinute, int perDay, boolean trustForwardedHeaders) {
        LettuceBasedProxyManager<String> proxyManager = mock(LettuceBasedProxyManager.class);
        doThrow(new IllegalStateException("redis unavailable")).when(proxyManager).builder();
        return new RateLimitFilter(proxyManager, new ObjectMapper(), perMinute, perDay, trustForwardedHeaders);
    }

    @SuppressWarnings("unchecked")
    private RateLimitFilter filter(int perMinute, int perDay) {
        return new RateLimitFilter(
                mock(LettuceBasedProxyManager.class),
                new ObjectMapper(),
                perMinute,
                perDay,
                false
        );
    }
}
