// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HeroPreviewCard } from "@/features/landing/components/HeroPreviewCard";
afterEach(() => { cleanup(); vi.useRealTimers(); });
const chapterTime = (note: HTMLElement) => {
  const timestamp = note.getAttribute("aria-label")!.split(" ")[0]!;
  const [minutes, seconds] = timestamp.split(":").map(Number);
  return { timestamp, seconds: minutes! * 60 + seconds! };
};
it("selects the third note and synchronizes the player position", () => {
  render(<HeroPreviewCard />);
  const note = screen.getByRole("button", { name: /Review and export/ });
  const time = chapterTime(note);
  fireEvent.click(note);
  expect(note.getAttribute("aria-pressed")).toBe("true");
  expect((screen.getByRole("slider") as HTMLInputElement).value).toBe(String(time.seconds));
  expect(screen.getByText(time.timestamp + " / 24:15")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Putting ideas/ }).getAttribute("aria-pressed")).toBe("false");
});
it("cycles through all three notes before returning to the first", () => {
  render(<HeroPreviewCard />);
  const positions = [/Putting ideas/, /Review and export/, /Understanding the main/]
    .map(name => chapterTime(screen.getByRole("button", { name })).seconds);
  for (const position of positions) {
    fireEvent.click(screen.getByRole("button", { name: "Jump to next chapter" }));
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe(String(position));
  }
});
it("updates the selected note when the player seeks backwards and forwards", () => {
  render(<HeroPreviewCard />);
  const thirdNote = screen.getByRole("button", { name: /Review and export/ });
  fireEvent.change(screen.getByRole("slider"), { target: { value: String(chapterTime(thirdNote).seconds + 1) } });
  expect(thirdNote.getAttribute("aria-pressed")).toBe("true");
  fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } });
  expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
  expect(screen.getByText("Video introduction")).toBeTruthy();
});
it("advances playback across a chapter, pauses, and cleans up its timer", () => {
  vi.useFakeTimers();
  const { unmount } = render(<HeroPreviewCard />);
  const secondTime = chapterTime(screen.getByRole("button", { name: /Putting ideas/ })).seconds;
  fireEvent.change(screen.getByRole("slider"), { target: { value: String(secondTime - 1) } });
  fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
  expect(screen.queryByRole("button", { name: "Play preview" })).toBeNull();
  expect(screen.getByRole("button", { name: "Pause preview" })).toBeTruthy();
  act(() => { vi.advanceTimersByTime(1000); });
  expect(screen.getByRole("button", { name: /Putting ideas/ }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Pause preview" }));
  expect(screen.queryByRole("button", { name: "Pause preview" })).toBeNull();
  expect(screen.getByRole("button", { name: "Play preview" })).toBeTruthy();
  act(() => { vi.advanceTimersByTime(3000); });
  expect((screen.getByRole("slider") as HTMLInputElement).value).toBe(String(secondTime));
  fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("stops at the duration and restarts from zero on play", () => {
  vi.useFakeTimers();
  render(<HeroPreviewCard />);
  fireEvent.change(screen.getByRole("slider"), { target: { value: "1454" } });
  fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
  act(() => { vi.advanceTimersByTime(2000); });
  expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("1455");
  expect(vi.getTimerCount()).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
  expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("0");
});
