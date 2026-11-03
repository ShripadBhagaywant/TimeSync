// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDialogFocus } from "@/components/ui/useDialogFocus";

function Panel({ open, close }: { open: boolean; close: () => void }) {
  const ref = useDialogFocus<HTMLDivElement>(open, close);
  return open ? <div ref={ref} role="dialog" tabIndex={-1}><button>First</button><button>Last</button></div> : null;
}
afterEach(cleanup);
it("wraps Tab and Shift+Tab and restores focus on close", () => {
  const trigger = document.createElement("button"); document.body.append(trigger); trigger.focus();
  const close = vi.fn();
  const { rerender } = render(<Panel open close={close} />);
  expect(document.activeElement).toBe(screen.getByText("First"));
  fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(screen.getByText("Last"));
  fireEvent.keyDown(document.activeElement!, { key: "Tab" });
  expect(document.activeElement).toBe(screen.getByText("First"));
  rerender(<Panel open={false} close={close} />);
  expect(document.activeElement).toBe(trigger); trigger.remove();
});
it("uses the latest Escape handler without moving focus on rerender", () => {
  const first = vi.fn(), second = vi.fn();
  const { rerender } = render(<Panel open close={first} />);
  screen.getByText("Last").focus();
  rerender(<Panel open close={second} />);
  expect(document.activeElement).toBe(screen.getByText("Last"));
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(second).toHaveBeenCalledOnce(); expect(first).not.toHaveBeenCalled();
});
