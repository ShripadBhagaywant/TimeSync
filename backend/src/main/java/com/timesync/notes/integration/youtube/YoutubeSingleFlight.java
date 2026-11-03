package com.timesync.notes.integration.youtube;

import com.timesync.notes.dto.response.TranscriptResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

/** Coordinates source extraction only; no per-user persistence or AI job state. */
@Slf4j
@Component
public class YoutubeSingleFlight {
    private final ConcurrentHashMap<String, Flight> flights = new ConcurrentHashMap<>();

    public TranscriptResponse execute(String videoId, Supplier<TranscriptResponse> extraction) {
        Flight leader = new Flight();
        Flight existing = flights.putIfAbsent(videoId, leader);
        if (existing != null) {
            existing.participants.incrementAndGet();
            log.debug("Joining in-flight transcript extraction for videoId={}", videoId);
            try {
                return existing.result.join();
            } catch (CompletionException failure) {
                if (existing.failure instanceof RuntimeException runtime) throw runtime;
                if (existing.failure instanceof Error error) throw error;
                throw failure;
            }
        }
        log.debug("Leading transcript extraction for videoId={}", videoId);
        try {
            TranscriptResponse result = extraction.get();
            leader.result.complete(result);
            return result;
        } catch (RuntimeException | Error failure) {
            leader.failure = failure;
            leader.result.completeExceptionally(failure);
            throw failure;
        } finally {
            flights.remove(videoId, leader);
        }
    }

    int inFlightCount() { return flights.size(); }

    int participants(String videoId) {
        Flight flight = flights.get(videoId);
        return flight == null ? 0 : flight.participants.get();
    }

    private static final class Flight {
        volatile Throwable failure;
        final CompletableFuture<TranscriptResponse> result = new CompletableFuture<>();
        final AtomicInteger participants = new AtomicInteger(1);
    }
}