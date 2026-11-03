// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { afterEach, describe, expect, it, vi } from "vitest";

import { AiRetryButton } from "@/features/workspace/components/AiRetryButton";

describe("AiRetryButton", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("invokes AI refinement when retry is available", () => {
    const onRetry = vi.fn();

    render(
      <AiRetryButton
        isStartingAi={false}
        retryAfterSeconds={null}
        retryKey="ready"
        onRetry={onRetry}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Retry AI",
      }),
    );

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("is disabled while AI refinement is starting", () => {
    const onRetry = vi.fn();

    render(
      <AiRetryButton
        isStartingAi
        retryAfterSeconds={null}
        retryKey="starting"
        onRetry={onRetry}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Retrying AI",
    }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);

    expect(screen.getByText("Retrying...")).toBeTruthy();
  });

  it("disables retry during provider cooldown", () => {
    vi.useFakeTimers();

    const onRetry = vi.fn();

    render(
      <AiRetryButton
        isStartingAi={false}
        retryAfterSeconds={30}
        retryKey="failure-1"
        onRetry={onRetry}
      />,
    );

    const button = screen.getByRole("button", {
      name: /Retry AI in 30 seconds/i,
    }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);

    fireEvent.click(button);

    expect(onRetry).not.toHaveBeenCalled();
  });

  it("counts down provider cooldown", () => {
    vi.useFakeTimers();

    const onRetry = vi.fn();

    render(
      <AiRetryButton
        isStartingAi={false}
        retryAfterSeconds={3}
        retryKey="failure-countdown"
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /Retry AI in 3 seconds/i,
      }),
    ).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1_100);
    });

    expect(
      screen.getByRole("button", {
        name: /Retry AI in 2 seconds/i,
      }),
    ).toBeTruthy();
  });

  it("enables retry when cooldown expires", () => {
    vi.useFakeTimers();

    const onRetry = vi.fn();

    render(
      <AiRetryButton
        isStartingAi={false}
        retryAfterSeconds={2}
        retryKey="failure-expire"
        onRetry={onRetry}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    expect(vi.getTimerCount()).toBe(0);

    const button = screen.getByRole("button", {
      name: "Retry AI",
    }) as HTMLButtonElement;

    expect(button.disabled).toBe(false);

    fireEvent.click(button);

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("restarts cooldown when a new failure has the same retry duration", () => {
    vi.useFakeTimers();

    const onRetry = vi.fn();

    const { rerender } = render(
      <AiRetryButton
        isStartingAi={false}
        retryAfterSeconds={30}
        retryKey="failure-1"
        onRetry={onRetry}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(30_500);
    });

    expect(
      (
        screen.getByRole("button", {
          name: "Retry AI",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    rerender(
      <AiRetryButton
        isStartingAi={false}
        retryAfterSeconds={30}
        retryKey="failure-2"
        onRetry={onRetry}
      />,
    );

    const restartedButton = screen.getByRole("button", {
      name: /Retry AI in 30 seconds/i,
    }) as HTMLButtonElement;

    expect(restartedButton.disabled).toBe(true);
  });

  it("clears cooldown when retryAfterSeconds becomes null", () => {
    vi.useFakeTimers();

    const onRetry = vi.fn();

    const { rerender } = render(
      <AiRetryButton
        isStartingAi={false}
        retryAfterSeconds={30}
        retryKey="failure"
        onRetry={onRetry}
      />,
    );

    expect(
      (
        screen.getByRole("button", {
          name: /Retry AI in 30 seconds/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    rerender(
      <AiRetryButton
        isStartingAi={false}
        retryAfterSeconds={null}
        retryKey="restored"
        onRetry={onRetry}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Retry AI",
    }) as HTMLButtonElement;

    expect(button.disabled).toBe(false);
  });
});
