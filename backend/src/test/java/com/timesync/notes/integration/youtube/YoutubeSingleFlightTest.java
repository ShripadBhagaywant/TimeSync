package com.timesync.notes.integration.youtube;

import com.timesync.notes.dto.response.TranscriptResponse;
import com.timesync.notes.exception.UpstreamRateLimitException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@Timeout(10)
class YoutubeSingleFlightTest {
    @Test void successRunsOnceForTenCallersAndRemovesFlight() throws Exception {
        exerciseTenCallers(null);
    }

    @Test void failurePreservesOriginalExceptionAndAllowsNextCall() throws Exception {
        exerciseTenCallers(new IllegalStateException("source unavailable"));
    }

    @Test void rateLimitPreservesOriginalExceptionAndAllowsNextCall() throws Exception {
        exerciseTenCallers(new UpstreamRateLimitException("limited", 60));
    }

    @Test void completionExceptionFromSourceIsPreservedAsOriginallyThrown() throws Exception {
        exerciseTenCallers(new CompletionException(new IllegalStateException("source")));
    }

    private void exerciseTenCallers(RuntimeException failure) throws Exception {
        var coordinator = new YoutubeSingleFlight();
        var expected = mock(TranscriptResponse.class);
        var invocations = new AtomicInteger();
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(10);
        Supplier<TranscriptResponse> source = () -> {
            invocations.incrementAndGet();
            entered.countDown();
            await(release);
            if (failure != null) throw failure;
            return expected;
        };
        List<Future<TranscriptResponse>> results = new ArrayList<>();
        try {
            results.add(pool.submit(() -> coordinator.execute("video", source)));
            assertTrue(entered.await(3, TimeUnit.SECONDS));
            for (int i = 1; i < 10; i++) results.add(pool.submit(() -> coordinator.execute("video", source)));
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
            while (coordinator.participants("video") < 10 && System.nanoTime() < deadline) Thread.onSpinWait();
            assertEquals(10, coordinator.participants("video"));
            release.countDown();
            for (Future<TranscriptResponse> result : results) {
                if (failure == null) assertSame(expected, result.get(3, TimeUnit.SECONDS));
                else assertSame(failure, assertThrows(ExecutionException.class,
                        () -> result.get(3, TimeUnit.SECONDS)).getCause());
            }
            assertEquals(1, invocations.get());
            assertEquals(0, coordinator.inFlightCount());
            assertSame(expected, coordinator.execute("video", () -> { invocations.incrementAndGet(); return expected; }));
            assertEquals(2, invocations.get());
            assertEquals(0, coordinator.inFlightCount());
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
    }

    @Test void differentVideoIdsProceedIndependently() throws Exception {
        var coordinator = new YoutubeSingleFlight();
        var bothEntered = new CountDownLatch(2);
        var release = new CountDownLatch(1);
        var result = mock(TranscriptResponse.class);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Supplier<TranscriptResponse> source = () -> { bothEntered.countDown(); await(release); return result; };
            var first = pool.submit(() -> coordinator.execute("first", source));
            var second = pool.submit(() -> coordinator.execute("second", source));
            assertTrue(bothEntered.await(3, TimeUnit.SECONDS));
            assertEquals(2, coordinator.inFlightCount());
            release.countDown();
            assertSame(result, first.get(3, TimeUnit.SECONDS));
            assertSame(result, second.get(3, TimeUnit.SECONDS));
            assertEquals(0, coordinator.inFlightCount());
        } finally { release.countDown(); pool.shutdownNow(); }
    }

    @Test void oneCallerExecutesOnceAndErrorsAlsoCleanUp() {
        var coordinator = new YoutubeSingleFlight();
        var result = mock(TranscriptResponse.class);
        assertSame(result, coordinator.execute("video", () -> result));
        var error = new AssertionError("fatal");
        assertSame(error, assertThrows(AssertionError.class, () -> coordinator.execute("video", () -> { throw error; })));
        assertEquals(0, coordinator.inFlightCount());
    }

    static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) throw new AssertionError("Latch timed out");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AssertionError(exception);
        }
    }
}