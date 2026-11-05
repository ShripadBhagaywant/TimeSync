import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiError";

const toastMocks = vi.hoisted(() => ({ errorToast: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/toast", () => ({
  notify: {
    errorToast: toastMocks.errorToast,
    error: toastMocks.error,
  },
}));

import { notifyApiError } from "@/lib/apiErrorNotifications";

describe("API error notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves the friendly YouTube bot-check message for 502 responses", () => {
    const error = new ApiError("upstream detail", {
      status: 502,
      code: "YOUTUBE_BOT_CHECK",
    });
    const description = "YouTube temporarily blocked transcript access. Reference: trace-id";

    notifyApiError(error, "Extraction Failed", description, "toast");

    expect(toastMocks.errorToast).toHaveBeenCalledWith("Extraction Failed", description);
  });

  it("preserves the friendly generic upstream message for 502 responses", () => {
    const error = new ApiError("upstream detail", {
      status: 502,
      code: "UPSTREAM_SERVICE_UNAVAILABLE",
    });

    notifyApiError(error, "Extraction Failed", "YouTube is temporarily unavailable.", "toast");

    expect(toastMocks.errorToast).toHaveBeenCalledWith(
      "Extraction Failed",
      "YouTube is temporarily unavailable.",
    );
  });

  it("keeps the generic safe message for unrecognized 502 responses", () => {
    notifyApiError(new ApiError("raw provider text", { status: 502 }), "Extraction Failed", "raw provider text", "toast");

    expect(toastMocks.errorToast).toHaveBeenCalledWith(
      "Extraction Failed",
      "A temporary server error interrupted this request. Please try again shortly.",
    );
  });
});
