package com.timesync.notes.exception;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String ERROR_BASE_URI = "https://timesync.com/errors/";

    private static final String INVALID_INPUT = "INVALID_INPUT";

    private static final String NOT_FOUND = "NOT_FOUND";

    private static final String INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR";

    private static final String UPSTREAM_SERVICE_UNAVAILABLE = "UPSTREAM_SERVICE_UNAVAILABLE";

    private static final String SHARE_SCHEMA_OUTDATED = "SHARE_SCHEMA_OUTDATED";

    private static final String STORAGE_UNAVAILABLE = "STORAGE_UNAVAILABLE";

    @ExceptionHandler(UpstreamRateLimitException.class)
    public ResponseEntity<ProblemDetail> handleUpstreamRateLimit(UpstreamRateLimitException ex) {

        String traceId = getOrGenerateTraceId();

        log.warn("YouTube rate limit handled: code={}", ex.getErrorCode());

        ProblemDetail problemDetail = createProblemDetail(
                        ex.getStatus(),
                        ex.getErrorCode(),
                        ex.getMessage(),
                        traceId
                );

        problemDetail.setProperty("retryAfterSeconds", ex.getRetryAfterSeconds());

        return ResponseEntity
                .status(ex.getStatus())
                .header(
                        HttpHeaders.RETRY_AFTER,
                        Long.toString(
                                ex.getRetryAfterSeconds()
                        )
                )
                .body(problemDetail);
    }

    @ExceptionHandler(AiProviderUnavailableException.class)
    public ResponseEntity<ProblemDetail> handleAiProviderUnavailable(AiProviderUnavailableException ex) {
        return aiProviderProblem(ex, ex.getRetryAfterSeconds());
    }

    @ExceptionHandler(AiProviderQuotaException.class)
    public ResponseEntity<ProblemDetail> handleAiProviderQuota(AiProviderQuotaException ex) {
        return aiProviderProblem(ex, ex.getRetryAfterSeconds());
    }

    private ResponseEntity<ProblemDetail> aiProviderProblem(ApiException ex, int retryAfterSeconds) {
        log.warn("AI provider failure handled: code={}, retryAfterSeconds={}", ex.getErrorCode(), retryAfterSeconds);
        ProblemDetail problem = createProblemDetail(ex.getStatus(), ex.getErrorCode(), ex.getMessage(), getOrGenerateTraceId());
        problem.setProperty("retryAfterSeconds", retryAfterSeconds);
        return ResponseEntity.status(ex.getStatus())
                .header(HttpHeaders.RETRY_AFTER, Integer.toString(retryAfterSeconds))
                .body(problem);
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ProblemDetail> handleApiException(ApiException ex) {

        String traceId = getOrGenerateTraceId();

        log.warn("API exception handled: code={}", ex.getErrorCode());

        ProblemDetail problemDetail = createProblemDetail(
                        ex.getStatus(),
                        ex.getErrorCode(),
                        ex.getMessage(),
                        traceId
                );

        if (ex instanceof NonEducationalContentException rejection && rejection.getDecision() != null) {
            var decision = rejection.getDecision();
            problemDetail.setProperty("contentEligibility", decision.eligibility());
            problemDetail.setProperty("verificationLevel", decision.verificationLevel());
            problemDetail.setProperty("contentReasonCode", decision.reasonCode());
        }

        return ResponseEntity
                .status(ex.getStatus())
                .body(problemDetail);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidationExceptions(MethodArgumentNotValidException ex) {

        String traceId = getOrGenerateTraceId();

        log.warn("Request validation failed");

        Map<String, String> errors = new HashMap<>();

        ex.getBindingResult()
                .getFieldErrors()
                .forEach(error -> errors.put(
                                        error.getField(),
                                        error.getDefaultMessage()
                                )
                );

        return buildValidationResponse(
                errors,
                traceId
        );
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ProblemDetail> handleConstraintViolation(ConstraintViolationException ex) {

        String traceId = getOrGenerateTraceId();

        log.warn("Constraint validation failed");

        Map<String, String> errors = new HashMap<>();

        ex.getConstraintViolations()
                .forEach(violation -> errors.put( violation
                                                .getPropertyPath()
                                                .toString(),
                                        violation.getMessage()
                                )
                );

        return buildValidationResponse(
                errors,
                traceId
        );
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ProblemDetail> handleNoResourceFound(NoResourceFoundException ex) {

        String traceId = getOrGenerateTraceId();

        log.warn("Resource not found");

        ProblemDetail problemDetail = createProblemDetail(
                        HttpStatus.NOT_FOUND,
                        NOT_FOUND,
                        "Endpoint resource not found: /"
                                + ex.getResourcePath(),
                        traceId
                );

        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(problemDetail);
    }

    @ExceptionHandler({
            ResourceAccessException.class,
            HttpServerErrorException.class
    })
    public ResponseEntity<ProblemDetail> handleUpstreamUnavailable(Exception ex) {

        String traceId = getOrGenerateTraceId();

        log.error("Upstream service unavailable: error={}", ex.getClass().getSimpleName());

        ProblemDetail problemDetail = createProblemDetail(
                        HttpStatus.BAD_GATEWAY,
                        UPSTREAM_SERVICE_UNAVAILABLE,
                        "An upstream service is temporarily unavailable.",
                        traceId
                );

        return ResponseEntity
                .status(HttpStatus.BAD_GATEWAY)
                .body(problemDetail);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> handleStorageConstraint(DataIntegrityViolationException ex) {

        String traceId = getOrGenerateTraceId();

        log.error("Shared-note database constraint rejected the snapshot: errorType={}", ex.getClass().getSimpleName());

        ProblemDetail problemDetail = createProblemDetail(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        SHARE_SCHEMA_OUTDATED,
                        "The shared-note database schema needs its startup migration. "
                                + "Restart the backend and retry.",
                        traceId
                );

        return ResponseEntity
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(problemDetail);
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ProblemDetail> handleStorageUnavailable(DataAccessException ex) {

        String traceId = getOrGenerateTraceId();

        log.error("Persistent storage unavailable: errorType={}", ex.getClass().getSimpleName());

        ProblemDetail problemDetail = createProblemDetail(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        STORAGE_UNAVAILABLE,
                        "Shared-note storage is temporarily unavailable. "
                                + "Start the database service and retry.",
                        traceId
                );

        return ResponseEntity
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(problemDetail);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGenericException(Exception ex) {

        String traceId = getOrGenerateTraceId();

        log.error("Unhandled server exception caught: error={}", ex.getClass().getSimpleName());

        ProblemDetail problemDetail = createProblemDetail(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        INTERNAL_SERVER_ERROR,
                        "An unexpected internal error occurred. "
                                + "Reference ID: "
                                + traceId,
                        traceId
                );

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(problemDetail);
    }

    private ResponseEntity<ProblemDetail> buildValidationResponse(Map<String, String> errors, String traceId)
    {

        ProblemDetail problemDetail = createProblemDetail(
                        HttpStatus.BAD_REQUEST,
                        INVALID_INPUT,
                        "Validation failed for request parameters",
                        traceId
                );

        /*
         * Preserve both properties for backward compatibility.
         */
        problemDetail.setProperty("errors", errors);

        problemDetail.setProperty("validationErrors", errors);

        return ResponseEntity
                .badRequest()
                .body(problemDetail);
    }

    private ProblemDetail createProblemDetail(HttpStatus status, String code, String detail, String traceId)
    {

        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(status, detail);

        problemDetail.setTitle(code);

        problemDetail.setType(buildErrorUri(code));

        problemDetail.setProperty("code", code);

        problemDetail.setProperty("timestamp", Instant.now());

        problemDetail.setProperty("traceId", traceId);

        return problemDetail;
    }

    private URI buildErrorUri(String code) {

        return URI.create(
                ERROR_BASE_URI
                        + code.toLowerCase()
        );
    }

    private String getOrGenerateTraceId() {

        return Optional
                .ofNullable( MDC.get("traceId"))
                .orElseGet(
                        () -> UUID.randomUUID().toString().substring(0, 8)
                );
    }
}
