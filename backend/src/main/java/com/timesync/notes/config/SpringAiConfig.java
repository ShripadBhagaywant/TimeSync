package com.timesync.notes.config;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.web.client.RestClient;

@Configuration
public class SpringAiConfig {

    @Bean
    @Primary
    public RestClient.Builder geminiRestClientBuilder(
            @Value("${app.gemini.request-timeout-seconds:45}") int timeoutSeconds) {
        if (timeoutSeconds < 1 || timeoutSeconds > 120) {
            throw new IllegalArgumentException("AI request timeout must be between 1 and 120 seconds");
        }
        var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        var factory = new JdkClientHttpRequestFactory(client);
        factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        return RestClient.builder().requestFactory(factory);
    }

    @Bean
    @Primary
    public RetryTemplate geminiRetryTemplate() {
        /*
         * GeminiAiCleaningStrategy owns model fallback.
         * Do not repeatedly retry the same overloaded model here.
         */
        return RetryTemplate.builder()
                .maxAttempts(1)
                .build();
    }

    @Bean
    @Primary
    public ChatClient chatClient(ChatModel chatModel) {
        return ChatClient.builder(chatModel)
                .build();
    }
}
