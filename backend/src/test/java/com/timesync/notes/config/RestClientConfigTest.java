package com.timesync.notes.config;
import com.timesync.notes.integration.youtube.YoutubeAvailabilityGuard;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RestClientConfigTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void doesNotCarryCookiesAcrossIndependentRequests() throws IOException {
        AtomicReference<String> receivedCookie = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/start", exchange -> {
            exchange.getResponseHeaders().add("Set-Cookie", "CONSENT=redirect-test; Path=/");
            respond(exchange, 200, "cookie-set");
        });
        server.createContext("/target", exchange -> {
            receivedCookie.set(exchange.getRequestHeaders().getFirst("Cookie"));
            respond(exchange, 200, "ok");
        });
        server.start();

        RestClient client = new RestClientConfig().restClient(new com.timesync.notes.integration.youtube.YoutubeAvailabilityGuard(60, 600));
        String firstResponse = client.get()
                .uri(baseUrl() + "/start")
                .retrieve()
                .body(String.class);
        String secondResponse = client.get()
                .uri(baseUrl() + "/target")
                .retrieve()
                .body(String.class);

        assertEquals("cookie-set", firstResponse);
        assertEquals("ok", secondResponse);
        assertNull(receivedCookie.get());
    }

    @Test
    void stopsAnInfiniteRedirectChainAtTheConfiguredLimit() throws IOException {
        AtomicInteger requests = new AtomicInteger();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/loop", exchange -> {
            requests.incrementAndGet();
            exchange.getResponseHeaders().add("Location", "/loop");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.start();

        RestClient client = new RestClientConfig().restClient(new com.timesync.notes.integration.youtube.YoutubeAvailabilityGuard(60, 600));

        assertThrows(ResourceAccessException.class, () -> client.get()
                .uri(baseUrl() + "/loop")
                .retrieve()
                .body(String.class));
        assertTrue(requests.get() <= 6, "Redirect loop must be bounded");
    }

    private String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
