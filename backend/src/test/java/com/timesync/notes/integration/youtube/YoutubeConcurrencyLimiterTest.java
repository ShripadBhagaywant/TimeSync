package com.timesync.notes.integration.youtube;

import com.timesync.notes.exception.UpstreamRateLimitException;
import com.timesync.notes.exception.YoutubeBusyException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.mock.http.client.MockClientHttpResponse;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static com.timesync.notes.integration.youtube.YoutubeAvailabilityScope.*;
import static org.junit.jupiter.api.Assertions.*;

@Timeout(10)
class YoutubeConcurrencyLimiterTest {
    private final YoutubeAvailabilityGuard guard = new YoutubeAvailabilityGuard(60, 600);

    @Test void bothScopesShareBoundAndPermitsAreReleasedAfterSuccess() throws Exception {
        var limiter = new YoutubeConcurrencyLimiter(2, 3000);
        var entered = new CountDownLatch(2);
        var release = new CountDownLatch(1);
        var active = new AtomicInteger();
        var peak = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(6);
        try {
            ClientHttpRequestExecution outbound = (request, body) -> {
                peak.accumulateAndGet(active.incrementAndGet(), Math::max);
                entered.countDown();
                YoutubeSingleFlightTest.await(release);
                active.decrementAndGet();
                return new MockClientHttpResponse(new byte[0], HttpStatus.OK);
            };
            var tasks = new ArrayList<Future<?>>();
            for (int i = 0; i < 6; i++) {
                var scope = i % 2 == 0 ? DATA_API : CAPTION;
                tasks.add(pool.submit(() -> limiter.execute(guard, scope, null, new byte[0], outbound)));
            }
            assertTrue(entered.await(3, TimeUnit.SECONDS));
            awaitQueue(limiter, 4);
            assertEquals(2, peak.get());
            assertEquals(0, limiter.availablePermits());
            release.countDown();
            for (var task : tasks) task.get(3, TimeUnit.SECONDS);
            assertEquals(2, peak.get());
            assertEquals(2, limiter.availablePermits());
        } finally { release.countDown(); pool.shutdownNow(); }
    }

    @Test void bodyDownloadHoldsPermitAndLocalExhaustionIs503() throws Exception {
        var limiter = new YoutubeConcurrencyLimiter(1, 0);
        var reading = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            var task = pool.submit(() -> limiter.execute(guard, CAPTION, null, new byte[0], (request, body) ->
                    new MockClientHttpResponse(new InputStream() {
                        @Override public int read() {
                            reading.countDown();
                            YoutubeSingleFlightTest.await(release);
                            return -1;
                        }
                    }, HttpStatus.OK)));
            assertTrue(reading.await(3, TimeUnit.SECONDS));
            var busy = assertThrows(YoutubeBusyException.class, () -> limiter.execute(guard, DATA_API,
                    null, new byte[0], (request, body) -> { fail("No request should start"); return null; }));
            assertEquals(HttpStatus.SERVICE_UNAVAILABLE, busy.getStatus());
            assertEquals("YOUTUBE_BUSY", busy.getErrorCode());
            assertEquals(0, guard.getRetryAfterSeconds(DATA_API));
            release.countDown();
            task.get(3, TimeUnit.SECONDS);
            assertEquals(1, limiter.availablePermits());
        } finally { release.countDown(); pool.shutdownNow(); }
    }

    @Test void releasesAfterNetworkBodyFailureAnd429() {
        var limiter = new YoutubeConcurrencyLimiter(1, 0);
        assertThrows(IOException.class, () -> limiter.execute(guard, CAPTION, null, new byte[0],
                (request, body) -> { throw new IOException("network"); }));
        assertEquals(1, limiter.availablePermits());
        var closed = new AtomicInteger();
        assertThrows(IOException.class, () -> limiter.execute(guard, CAPTION, null, new byte[0],
                (request, body) -> new MockClientHttpResponse(new InputStream() {
                    @Override public int read() throws IOException { throw new IOException("download"); }
                    @Override public void close() { closed.incrementAndGet(); }
                }, HttpStatus.OK)));
        assertEquals(1, closed.get());
        assertEquals(1, limiter.availablePermits());
        assertThrows(UpstreamRateLimitException.class, () -> limiter.execute(guard, CAPTION, null, new byte[0],
                (request, body) -> new MockClientHttpResponse(new byte[0], HttpStatus.TOO_MANY_REQUESTS)));
        assertEquals(1, limiter.availablePermits());
    }

    @Test void cooldownCheckedBeforeWaitingAndAgainAfterAcquiring() throws Exception {
        var limiter = new YoutubeConcurrencyLimiter(1, 3000);
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            var active = pool.submit(() -> limiter.execute(guard, DATA_API, null, new byte[0], (request, body) -> {
                entered.countDown();
                YoutubeSingleFlightTest.await(release);
                return new MockClientHttpResponse(new byte[0], HttpStatus.OK);
            }));
            assertTrue(entered.await(3, TimeUnit.SECONDS));
            var queued = pool.submit(() -> limiter.execute(guard, CAPTION, null, new byte[0], (request, body) -> {
                fail("Queued content request must recheck cooldown"); return null;
            }));
            awaitQueue(limiter, 1);
            guard.recordRateLimit(CAPTION);
            assertThrows(UpstreamRateLimitException.class, () -> limiter.execute(guard, CAPTION, null, new byte[0],
                    (request, body) -> { fail(); return null; }));
            assertEquals(1, limiter.queuedRequests());
            release.countDown();
            active.get(3, TimeUnit.SECONDS);
            assertInstanceOf(UpstreamRateLimitException.class,
                    assertThrows(ExecutionException.class, () -> queued.get(3, TimeUnit.SECONDS)).getCause());
            assertEquals(1, limiter.availablePermits());
        } finally { release.countDown(); pool.shutdownNow(); }
    }

    @Test void invalidConfigurationRejected() {
        assertThrows(IllegalArgumentException.class, () -> new YoutubeConcurrencyLimiter(0, 10));
        assertThrows(IllegalArgumentException.class, () -> new YoutubeConcurrencyLimiter(1, -1));
    }

    private static void awaitQueue(YoutubeConcurrencyLimiter limiter, int count) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
        while (limiter.queuedRequests() < count && System.nanoTime() < deadline) Thread.onSpinWait();
        assertEquals(count, limiter.queuedRequests());
    }
}