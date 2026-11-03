import axios, { AxiosError } from "axios";

import { ApiError, type ApiErrorPayload } from "./apiError";

const readRetryAfter = (body: unknown, header: unknown): number | undefined => {
  if (typeof body === "number" && Number.isFinite(body) && body >= 0) return Math.ceil(body);
  if (typeof header !== "string" && typeof header !== "number") return undefined;
  const value = String(header).trim();
  if (/^\d+(\.\d+)?$/.test(value)) return Math.ceil(Number(value));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : undefined;
};

const getErrorMessage = (error: AxiosError<ApiErrorPayload>) => {
  const data = error.response?.data;

  return (
    data?.message ||
    data?.detail ||
    error.message ||
    "An unexpected error occurred."
  );
};

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 120_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorPayload>) => {
    const payload = error.response?.data;

    return Promise.reject(
      new ApiError(getErrorMessage(error), {
        status: error.response?.status,
        code: payload?.code || payload?.title,
        details: payload?.errors || payload?.validationErrors,
        traceId: payload?.traceId,
        retryAfterSeconds: readRetryAfter(payload?.retryAfterSeconds, error.response?.headers?.["retry-after"]),
      }),
    );
  },
);
