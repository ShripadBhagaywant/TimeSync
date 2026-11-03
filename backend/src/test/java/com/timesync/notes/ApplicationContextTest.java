package com.timesync.notes;

import com.timesync.notes.repository.SharedNoteRepository;
import com.timesync.notes.strategy.GeminiAiCleaningStrategy;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.lettuce.core.api.StatefulRedisConnection;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.annotation.DirtiesContext;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/** Real application wiring; external persistence is mocked, provider is never called. */
@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration",
        "spring.ai.openai.api-key=test-not-a-real-key",
        "spring.ai.openai.base-url=http://127.0.0.1:1",
        "app.api-keys.youtube=test-not-a-real-key"
})
@DirtiesContext
class ApplicationContextTest {
    @MockBean SharedNoteRepository repository;
    @MockBean(name = "lettuceRedisConnection") StatefulRedisConnection<String, byte[]> connection;
    @MockBean(name = "bucket4jProxyManager") LettuceBasedProxyManager<String> proxyManager;
    @Autowired GeminiAiCleaningStrategy strategy;
    @Test void contextLoads() { assertNotNull(strategy); }
}
