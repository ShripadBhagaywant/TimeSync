package com.timesync.notes.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Configuration
public class ThreadPoolConfig {

    @Bean(name = "playlistBatchExecutor", destroyMethod = "shutdown")
    public ExecutorService playlistBatchExecutor(
            @Value("${app.playlist.worker-threads:6}") int workerThreads) {
        return boundedExecutor(workerThreads, 25, "timesync-playlist-worker-");
    }

    @Bean(name = "aiChunkExecutor", destroyMethod = "shutdown")
    public ExecutorService aiChunkExecutor(
            @Value("${app.gemini.worker-threads:1}") int workerThreads) {
        return boundedAiExecutor(workerThreads, 20, "ai-chunk-worker-");
    }

    @Bean(name = "aiJobExecutor", destroyMethod = "shutdown")
    public ExecutorService aiJobExecutor(
            @Value("${app.gemini.job-worker-threads:1}") int workerThreads) {
        return boundedAiExecutor(workerThreads, 4, "ai-note-job-worker-");
    }

    @Bean(name = "playlistJobExecutor", destroyMethod = "shutdown")
    public ExecutorService playlistJobExecutor() {
        int threads = 2;
        return new ThreadPoolExecutor(
                threads,
                threads,
                0L,
                TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(8),
                namedThreadFactory("playlist-job-worker-"),
                new ThreadPoolExecutor.AbortPolicy()
        );
    }

    private ExecutorService boundedAiExecutor(int configuredThreads, int maximumThreads, String prefix) {
        ThreadPoolExecutor executor = (ThreadPoolExecutor) boundedExecutor(configuredThreads, maximumThreads, prefix);
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        return executor;
    }

    private ExecutorService boundedExecutor(int configuredThreads, int maximumThreads, String namePrefix) {
        int threads = Math.max(1, Math.min(configuredThreads, maximumThreads));
        ThreadFactory threadFactory = namedThreadFactory(namePrefix);

        return new ThreadPoolExecutor(
                threads,
                threads,
                0L,
                TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(threads * 4),
                threadFactory,
                new ThreadPoolExecutor.CallerRunsPolicy()
        );
    }

    private ThreadFactory namedThreadFactory(String namePrefix) {
        AtomicInteger sequence = new AtomicInteger();
        return runnable -> {
            Thread thread = new Thread(runnable);
            thread.setName(namePrefix + sequence.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        };
    }
}
