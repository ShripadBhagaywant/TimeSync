package com.timesync.notes.controller;

import com.timesync.notes.exception.*;
import com.timesync.notes.service.TranscriptCleaningService;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.stream.Stream;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AiProviderExceptionContractTest {
    static Stream<ApiException> failures() {
        return Stream.of(new AiProviderUnavailableException("Verification unavailable", new RuntimeException("PRIVATE_PAYLOAD"), 30),
                new AiProviderQuotaException("Verification rate-limited", new RuntimeException("PRIVATE_PAYLOAD"), 47));
    }

    @ParameterizedTest @MethodSource("failures")
    void classifierProviderErrorsExposeStatusCodeAndRetryHints(ApiException failure) throws Exception {
        var service = mock(TranscriptCleaningService.class);
        when(service.refineTranscript(any())).thenThrow(failure);
        int retryAfter = failure instanceof AiProviderUnavailableException unavailable
                ? unavailable.getRetryAfterSeconds() : ((AiProviderQuotaException) failure).getRetryAfterSeconds();
        var mvc = MockMvcBuilders.standaloneSetup(new ExtractionController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(post("/api/v1/extract/video/refine").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"videoId":"abcdefghijk","transcript":"Imported evidence","targetLanguage":"English"}
                                """))
                .andExpect(status().is(failure.getStatus().value()))
                .andExpect(jsonPath("$.code").value(failure.getErrorCode()))
                .andExpect(jsonPath("$.detail").value(failure.getMessage()))
                .andExpect(jsonPath("$.retryAfterSeconds").value(retryAfter))
                .andExpect(header().string("Retry-After", Integer.toString(retryAfter)))
                .andExpect(jsonPath("$.traceId").isNotEmpty())
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("PRIVATE_PAYLOAD"))));
        verify(service).refineTranscript(any());
    }
}
