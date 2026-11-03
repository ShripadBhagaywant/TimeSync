package com.timesync.notes.config;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.web.client.RestClient;

@Configuration
public class VerificationClientConfig {
    @Bean
    public ChatClient verificationChatClient(
            @Value("${spring.ai.openai.chat.api-key:${spring.ai.openai.api-key}}") String apiKey,
            @Value("${spring.ai.openai.chat.base-url:${spring.ai.openai.base-url}}") String baseUrl,
            @Value("${spring.ai.openai.chat.completions-path:/v1/chat/completions}") String completionsPath,
            @Value("${app.gemini.verification-model:${app.gemini.fallback-model:${spring.ai.openai.chat.options.model}}}") String model,
            @Value("${app.gemini.verification-timeout-seconds:20}") int timeoutSeconds) {
        return buildClient(apiKey, baseUrl, completionsPath, model, timeoutSeconds);
    }

    @Bean
    public ChatClient verificationFallbackChatClient(
            @Value("${spring.ai.openai.chat.api-key:${spring.ai.openai.api-key}}") String apiKey,
            @Value("${spring.ai.openai.chat.base-url:${spring.ai.openai.base-url}}") String baseUrl,
            @Value("${spring.ai.openai.chat.completions-path:/v1/chat/completions}") String completionsPath,
            @Value("${spring.ai.openai.chat.options.model:${app.gemini.fallback-model}}") String model,
            @Value("${app.gemini.verification-fallback-timeout-seconds:8}") int timeoutSeconds) {
        return buildClient(apiKey, baseUrl, completionsPath, model, timeoutSeconds);
    }

    private ChatClient buildClient(String apiKey, String baseUrl, String completionsPath,
                                   String model, int timeoutSeconds) {
        if (timeoutSeconds < 1 || timeoutSeconds > 60) {
            throw new IllegalArgumentException("Verification timeout must be between 1 and 60 seconds");
        }
        var httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        var requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        var api = OpenAiApi.builder().apiKey(apiKey).baseUrl(baseUrl).completionsPath(completionsPath)
                .restClientBuilder(RestClient.builder().requestFactory(requestFactory)).build();
        var chatModel = OpenAiChatModel.builder().openAiApi(api)
                .defaultOptions(OpenAiChatOptions.builder().model(model).reasoningEffort("low").build())
                .retryTemplate(RetryTemplate.builder().maxAttempts(1).build()).build();
        return ChatClient.builder(chatModel).build();
    }
}
