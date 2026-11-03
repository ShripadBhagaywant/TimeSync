package com.timesync.notes.config;

import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AiExecutorCapacityTest {
    @Test void fullAiQueuesRejectInsteadOfBlockingTheSubmittingThread() throws Exception {
        for (ExecutorService executor : new ExecutorService[]{
                new ThreadPoolConfig().aiJobExecutor(1), new ThreadPoolConfig().aiChunkExecutor(1)}) {
            var entered = new CountDownLatch(1);
            var release = new CountDownLatch(1);
            try {
                executor.execute(() -> {
                    entered.countDown();
                    try { release.await(); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
                });
                assertTrue(entered.await(5, TimeUnit.SECONDS));
                for (int i = 0; i < 4; i++) executor.execute(() -> {});
                assertThrows(RejectedExecutionException.class, () -> executor.execute(() -> fail("Must not run inline")));
            } finally {
                release.countDown();
                executor.shutdownNow();
            }
        }
    }
}
