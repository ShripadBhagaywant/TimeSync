package com.timesync.notes.service;

import com.timesync.notes.exception.UnprocessableVideoException;
import com.timesync.notes.service.impl.YoutubeExtractionServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.retry.annotation.Recover;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class YoutubeRetryRecoveryTest {

    @Test
    void genericDomainErrorsCannotBeCapturedByNetworkRecovery() {
        boolean hasGenericExceptionRecover = Arrays.stream(YoutubeExtractionServiceImpl.class.getMethods())
                .filter(method -> method.isAnnotationPresent(Recover.class))
                .map(Method::getParameterTypes)
                .anyMatch(parameters -> parameters.length > 0 && parameters[0] == Exception.class);

        assertFalse(hasGenericExceptionRecover);

        boolean hasDomainPassThroughRecover = Arrays.stream(YoutubeExtractionServiceImpl.class.getMethods())
                .filter(method -> method.isAnnotationPresent(Recover.class))
                .map(Method::getParameterTypes)
                .anyMatch(parameters -> parameters.length > 0
                        && parameters[0] == UnprocessableVideoException.class);

        assertTrue(hasDomainPassThroughRecover);
    }
}
