import { describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiError";
import { getUserFacingApiError, shouldRetryExtraction } from "@/features/extraction/utils/extractionErrors";
import { apiClient } from "@/lib/axios";
import { queryClient } from "@/lib/queryClient";

const rejectResponse = (data: Record<string, unknown>, headers: Record<string, string> = {}, status = 429) =>
  apiClient.get("/local-test", {
    adapter: async (config) => {
      throw new AxiosError("upstream", "ERR_BAD_RESPONSE", config, undefined, {
        data, headers, status, statusText: status === 503 ? "Service Unavailable" : "Too Many Requests", config,
      });
    },
  });

describe("extraction API errors", () => {
  it("retains status, code, body retry delay and trace ID", async () => {
    await expect(rejectResponse({code: "YOUTUBE_RATE_LIMITED", retryAfterSeconds: 47, traceId: "trace"},
      {"retry-after": "60"})).rejects.toMatchObject({
        status: 429, code: "YOUTUBE_RATE_LIMITED", retryAfterSeconds: 47, traceId: "trace",
      });
  });

  it("uses Retry-After seconds when the body has no delay", async () => {
    await expect(rejectResponse({code: "YOUTUBE_RATE_LIMITED"}, {"retry-after": "25"}))
      .rejects.toMatchObject({retryAfterSeconds: 25});
  });

  it("supports HTTP-date Retry-After and ignores invalid delays", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-09T00:00:00Z"));
    try {
      await expect(rejectResponse({}, {"retry-after": "Wed, 09 Sep 2026 00:00:30 GMT"}))
        .rejects.toMatchObject({retryAfterSeconds: 30});
      await expect(rejectResponse({retryAfterSeconds: -3}, {"retry-after": "invalid"}))
        .rejects.toMatchObject({retryAfterSeconds: undefined});
    } finally { vi.restoreAllMocks(); }
  });

  it("shows the retry delay and defaults to sixty seconds", () => {
    expect(getUserFacingApiError(new ApiError("old", {code: "YOUTUBE_RATE_LIMITED", retryAfterSeconds: 47}), "fallback"))
      .toContain("Retry in about 47 seconds.");
    expect(getUserFacingApiError(new ApiError("old", {code: "YOUTUBE_RATE_LIMITED"}), "fallback"))
      .toContain("Retry in about 60 seconds.");
  });

  it("caption and busy messages never suggest metadata or manual transcript fallback", () => {
    const captions = getUserFacingApiError(new ApiError("legacy", {code: "CAPTIONS_UNAVAILABLE"}), "fallback");
    expect(captions).toBe("This video cannot be processed because its transcript is unavailable.");
    expect(captions).not.toMatch(/paste|metadata|workspace/i);
    expect(getUserFacingApiError(new ApiError("legacy", {code: "YOUTUBE_BUSY"}), "fallback"))
      .toBe("YouTube processing is busy right now. Please wait a moment and try again.");
  });

  it("shows a safe message for YouTube bot checks and does not retry immediately", () => {
    const error = new ApiError("Sign in to confirm you're not a bot", {
      code: "YOUTUBE_BOT_CHECK",
      status: 502,
      traceId: "2c16b053",
    });
    const message = getUserFacingApiError(error, "fallback");

    expect(message).toContain("YouTube temporarily blocked transcript access for this video.");
    expect(message).not.toContain("Sign in to confirm");
    expect(message).toContain("Reference: 2c16b053");
    expect(shouldRetryExtraction(0, error)).toBe(false);
  });
  it.each(["YOUTUBE_RATE_LIMITED", "YOUTUBE_BUSY", "CAPTIONS_UNAVAILABLE"])(
    "React Query does not immediately retry %s", async (code) => {
      const client = new QueryClient({defaultOptions: queryClient.getDefaultOptions()});
      const error = new ApiError("failed", {code});
      const queryFn = vi.fn().mockRejectedValue(error);
      try {
        await expect(client.fetchQuery({queryKey: [code], queryFn, retryDelay: 0})).rejects.toBe(error);
        expect(queryFn).toHaveBeenCalledOnce();
      } finally { client.clear(); }
    },
  );

  it("retains one retry for network and other server failures", () => {
    expect(shouldRetryExtraction(0, new Error("network"))).toBe(true);
    expect(shouldRetryExtraction(0, new ApiError("server", {status: 502}))).toBe(true);
    expect(shouldRetryExtraction(1, new Error("network"))).toBe(false);
    expect(shouldRetryExtraction(0, new ApiError("invalid", {status: 422}))).toBe(false);
  });
});
describe.each([
  ["AI_PROVIDER_UNAVAILABLE", 503, "Educational verification is temporarily unavailable"],
  ["AI_PROVIDER_QUOTA_EXCEEDED", 429, "AI verification is temporarily rate-limited"],
] as const)("AI provider HTTP error %s", (code, status, friendly) => {
  it("retains body retry delay, status, trace and friendly timing", async () => {
    const error = await rejectResponse({ code, retryAfterSeconds: 31, traceId: "verification-trace", detail: "RAW_PROVIDER_PAYLOAD" }, { "retry-after": "60" }, status).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, code, retryAfterSeconds: 31 });
    const message = getUserFacingApiError(error, "fallback");
    expect(message).toContain(friendly);
    expect(message).toContain("31 seconds");
    expect(message).toContain("verification-trace");
    expect(message).not.toMatch(/entertainment|non.educational|RAW_PROVIDER_PAYLOAD/i);
  });
  it("uses Retry-After when the body omits delay", async () => {
    await expect(rejectResponse({ code }, { "retry-after": "22" }, status)).rejects.toMatchObject({ retryAfterSeconds: 22, status, code });
  });
  it("uses safe friendly wording when no retry timing exists", () => {
    const message = getUserFacingApiError(new ApiError("RAW_PROVIDER_PAYLOAD", { code, status }), "fallback");
    expect(message).toBe(friendly + ". Please wait and retry.");
  });
});
