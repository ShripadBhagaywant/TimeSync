export interface ApiErrorPayload {
  code?: string;
  title?: string;
  message?: string;
  detail?: string;
  errors?: Record<string, string>;
  validationErrors?: Record<string, string>;
  traceId?: string;
  retryAfterSeconds?: number | null;
}

export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly details?: Record<string, string>;
  readonly traceId?: string;
  readonly retryAfterSeconds?: number | null;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      details?: Record<string, string>;
      traceId?: string;
      retryAfterSeconds?: number | null;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options?.status;
    this.code = options?.code;
    this.details = options?.details;
    this.traceId = options?.traceId;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

