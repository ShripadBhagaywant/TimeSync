// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TranscriptImportDialog } from "@/features/workspace/components/transcript/TranscriptImportDialog";
afterEach(cleanup);
it("preserves pasted text when parsing fails and clears only after success", async () => {
  const submit = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<TranscriptImportDialog isOpen isSubmitting={false} onClose={vi.fn()} onSubmit={submit} />);
  const input = screen.getByRole("textbox", { name: "Timestamped transcript" }) as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "0:00\nMy transcript" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Parse transcript" })));
  expect(input.value).toBe("0:00\nMy transcript");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Parse transcript" })));
  expect(input.value).toBe("");
});
it("blocks repeat submissions while the first parse is pending", async () => {
  let complete!: (value: boolean) => void;
  const submit = vi.fn(() => new Promise<boolean>(resolve => { complete = resolve; }));
  render(<TranscriptImportDialog isOpen isSubmitting={false} onClose={vi.fn()} onSubmit={submit} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "0:00\nEvidence" } });
  const button = screen.getByRole("button", { name: "Parse transcript" });
  fireEvent.click(button); fireEvent.click(button);
  expect(submit).toHaveBeenCalledOnce();
  await act(async () => complete(false));
});

it("shows immediate busy feedback before the parent updates", async () => {
  let complete!: (value: boolean) => void;
  const submit = vi.fn(() => new Promise<boolean>(resolve => { complete = resolve; }));
  render(<TranscriptImportDialog isOpen isSubmitting={false} onClose={vi.fn()} onSubmit={submit} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "0:00 Intro" } });
  fireEvent.click(screen.getByRole("button", { name: "Parse transcript" }));
  expect((screen.getByRole("button", { name: "Parsing transcript..." }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("Reading timestamps");
  await act(async () => complete(false));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("0:00 Intro");
});
it("counts standalone and inline timestamps and supports the parse shortcut", async () => {
  const submit = vi.fn().mockResolvedValue(false);
  render(<TranscriptImportDialog isOpen isSubmitting={false} onClose={vi.fn()} onSubmit={submit} />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "0:00 Introduction\n0:10\nLesson\n1:02:30 Summary" } });
  expect(screen.getByText(/3 timestamps found/)).toBeTruthy();
  await act(async () => fireEvent.keyDown(input, { key: "Enter", ctrlKey: true }));
  expect(submit).toHaveBeenCalledOnce();
});
