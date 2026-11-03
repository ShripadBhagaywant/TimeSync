package com.timesync.notes.integration.gemini;

import com.timesync.notes.exception.AiProviderQuotaException;
import com.timesync.notes.exception.AiProviderUnavailableException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Maps provider failures; scheduling and fallback decisions remain in the strategy. */
public final class GeminiFailureMapper {
    private GeminiFailureMapper() {} 

    private static final Pattern RETRY_SECONDS = Pattern.compile(
            "(?:Please retry in\\s*|retryDelay\\\"\\s*:\\s*\\\")(\\d+(?:\\.\\d+)?)s",
            Pattern.CASE_INSENSITIVE
    );

    public static boolean shouldUseFallback(Throwable failure) {
        return isHighDemand(failure)
                || isMissingOrRetiredModel(failure)
                || isRequestTimeout(failure);
    }

    private static boolean isMissingOrRetiredModel(
            Throwable failure) {

        String normalized =
                rootMessage(failure).toLowerCase();

        if (!normalized.contains("404")) {
            return false;
        }

        boolean referencesModel =
                normalized.contains("model")
                        || normalized.contains("models/")
                        || normalized.contains("not_found");

        boolean indicatesMissing =
                normalized.contains("no longer available")
                        || normalized.contains("not found")
                        || normalized.contains("not_found");

        return referencesModel && indicatesMissing;
    }

    public static AiProviderQuotaException quotaException(
            Exception failure) {

        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof AiProviderQuotaException quota) return quota;
        }

        String message = rootMessage(failure);
        String normalized = message.toLowerCase();

        if (!normalized.contains("429")) {

            return null;
        }

        Matcher matcher =
                RETRY_SECONDS.matcher(message);

        int retryAfter =
                matcher.find()
                        ? Math.max(
                        1,
                        (int) Math.ceil(
                                Double.parseDouble(
                                        matcher.group(1)
                                )
                        )
                )
                        : 60;

        return new AiProviderQuotaException(
                "Gemini quota is temporarily exhausted. "
                        + "Retry in about "
                        + retryAfter
                        + " seconds.",
                failure,
                retryAfter
        );
    }

    public static AiProviderUnavailableException unavailableException(
            Exception failure) {

        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof AiProviderUnavailableException unavailable) return unavailable;
        }

        if (!isHighDemand(failure) && !isTransportFailure(failure)) {
            return null;
        }

        return new AiProviderUnavailableException(
                "Gemini is temporarily unavailable. "
                        + "Retry in about 30 seconds.",
                failure,
                30
        );
    }

    private static boolean isRequestTimeout(Throwable failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof java.net.SocketTimeoutException
                    || cause instanceof java.net.http.HttpTimeoutException
                    || cause instanceof java.util.concurrent.TimeoutException) return true;
        }
        return false;
    }

    private static boolean isTransportFailure(Throwable failure) {
        if (isRequestTimeout(failure)) return true;
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof org.springframework.web.client.ResourceAccessException) return true;
        }
        return false;
    }

    private static boolean isHighDemand(
            Throwable failure) {

        String normalized =
                rootMessage(failure).toLowerCase();

        return normalized.contains("503")
                && (
                normalized.contains("high demand")
                        || normalized.contains("unavailable")
        );
    }

    public static String rootMessage(
            Throwable failure) {

        Throwable current = failure;
        StringBuilder messages = new StringBuilder();

        while (current != null) {

            if (current.getMessage() != null
                    && !current.getMessage().isBlank()) {

                if (!messages.isEmpty()) {
                    messages.append(" | ");
                }

                messages.append(
                        current.getMessage()
                );
            }

            current = current.getCause();
        }

        return messages.isEmpty()
                ? failure.getClass().getSimpleName()
                : messages.toString();
    }

}
