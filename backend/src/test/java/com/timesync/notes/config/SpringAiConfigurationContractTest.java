package com.timesync.notes.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.Environment;

import static org.assertj.core.api.Assertions.assertThat;
public class SpringAiConfigurationContractTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withPropertyValues(
                    "spring.ai.openai.api-key=test-key",
                    "spring.ai.openai.base-url=https://generativelanguage.googleapis.com",
                    "spring.ai.openai.chat.completions-path=/v1beta/openai/chat/completions",
                    "spring.ai.openai.chat.options.model=gemini-test-model"
            );

    @Test
    void keepsGeminiHostAndCompletionPathSeparated() {
        contextRunner.run(context -> {
            Environment environment = context.getEnvironment();

            assertThat(environment.getProperty("spring.ai.openai.base-url"))
                    .isEqualTo("https://generativelanguage.googleapis.com");
            assertThat(environment.getProperty("spring.ai.openai.chat.completions-path"))
                    .isEqualTo("/v1beta/openai/chat/completions");
        });
    }

}
