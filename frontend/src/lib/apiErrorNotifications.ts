import { ApiError } from "@/lib/apiError";
import { notify } from "@/lib/toast";

const BAD_GATEWAY_MESSAGE =
  "A temporary server error interrupted this request. Please try again shortly.";

export const notifyApiError = (
  error: unknown,
  title: string,
  description: string,
  presentation: "dialog" | "toast" = "dialog",
): void => {
  if (error instanceof ApiError && error.status === 502) {
    notify.errorToast(title, BAD_GATEWAY_MESSAGE);
    return;
  }
  if (presentation === "toast") {
    notify.errorToast(title, description);
    return;
  }
  notify.error(title, description);
};
