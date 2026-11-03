import React, { useEffect, useState } from "react";
import { BrandLoader } from "@/components/ui/BrandLoader";

interface AiRetryButtonProps {
  isStartingAi: boolean;
  retryAfterSeconds?: number | null;
  retryKey?: string | null;
  onRetry: () => void;
}

// A new retry attempt owns a fresh countdown; unrelated rerenders keep its deadline.
export const AiRetryButton: React.FC<AiRetryButtonProps> = (props) => (
  <RetryCountdown key={JSON.stringify([props.retryKey, props.retryAfterSeconds])} {...props} />
);

const RetryCountdown: React.FC<AiRetryButtonProps> = ({ isStartingAi, retryAfterSeconds, onRetry }) => {
  const [retryAvailableAt] = useState(() =>
    retryAfterSeconds != null && retryAfterSeconds > 0
      ? Date.now() + retryAfterSeconds * 1_000
      : null,
  );
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    retryAfterSeconds != null && retryAfterSeconds > 0 ? Math.ceil(retryAfterSeconds) : 0,
  );
  useEffect(() => {
    if (retryAvailableAt == null) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((retryAvailableAt - Date.now()) / 1_000));
      setRemainingSeconds(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [retryAvailableAt]);

  const isCoolingDown = remainingSeconds > 0;

  const disabled = isStartingAi || isCoolingDown;

  const ariaLabel = isStartingAi
    ? "Retrying AI"
    : isCoolingDown
      ? `Retry AI in ${remainingSeconds} seconds`
      : "Retry AI";

  const label = isStartingAi
    ? "Retrying..."
    : isCoolingDown
      ? `Retry AI in ${remainingSeconds}s`
      : "Retry AI";

  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-busy={isStartingAi}
      className="
        inline-flex
        items-center
        gap-1.5
        rounded-lg
        bg-amber-600
        px-3
        py-1.5
        text-[11px]
        font-semibold
        text-white
        transition-colors
        hover:bg-amber-700
        disabled:cursor-not-allowed
        disabled:opacity-60
      "
    >
      {isStartingAi && (
        <BrandLoader size="xs" tone="inverse" />
      )}

      {label}
    </button>
  );
};
