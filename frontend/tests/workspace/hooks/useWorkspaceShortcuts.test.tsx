// @vitest-environment jsdom
import { act, cleanup, fireEvent, renderHook, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useWorkspaceShortcuts } from "@/features/workspace/hooks/useWorkspaceShortcuts";
import { ShortcutsModal } from "@/features/workspace/components/shortcuts/ShortcutsModal";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  useWorkspaceStore.getState().setShowShortcutPanel(true);
});
it("leaves Space on buttons to their native keyboard behavior", () => {
  const play = vi.fn(); renderHook(() => useWorkspaceShortcuts({ onTogglePlay: play }));
  const button = document.createElement("button"); document.body.append(button); button.focus();
  fireEvent.keyDown(button, { code: "Space", key: " " });
  expect(play).not.toHaveBeenCalled();
});
it("does not seek or insert timestamps while a dialog has focus", () => {
  const stamp = vi.fn(); renderHook(() => useWorkspaceShortcuts({ onInsertTimestamp: stamp }));
  useWorkspaceStore.getState().clearSeekRequest();
  const dialog = document.createElement("div"); dialog.setAttribute("role", "dialog"); document.body.append(dialog);
  fireEvent.keyDown(dialog, { code: "KeyN", altKey: true });
  fireEvent.keyDown(dialog, { code: "ArrowRight" });
  expect(stamp).not.toHaveBeenCalled(); expect(useWorkspaceStore.getState().seekRequestedTime).toBeNull();
});
it("preserves the timestamp shortcut in the editor", () => {
  const stamp = vi.fn(); renderHook(() => useWorkspaceShortcuts({ onInsertTimestamp: stamp }));
  const editor = document.createElement("div"); editor.setAttribute("contenteditable", "true"); document.body.append(editor); editor.focus();
  fireEvent.keyDown(editor, { code: "KeyN", altKey: true });
  expect(stamp).toHaveBeenCalledOnce();
});

it.each(["input", "textarea", "select"])("does not hijack typing or Alt+N in a %s", tag => {
  const play = vi.fn(), stamp = vi.fn();
  renderHook(() => useWorkspaceShortcuts({ onTogglePlay: play, onInsertTimestamp: stamp }));
  const input = document.createElement(tag); document.body.append(input); input.focus();
  useWorkspaceStore.getState().clearSeekRequest();
  fireEvent.keyDown(input, { code: "KeyK" });
  fireEvent.keyDown(input, { code: "ArrowRight" });
  fireEvent.keyDown(input, { code: "KeyN", altKey: true });
  expect(play).not.toHaveBeenCalled(); expect(stamp).not.toHaveBeenCalled();
  expect(useWorkspaceStore.getState().seekRequestedTime).toBeNull();
});
it("keeps player controls out of nested editor content", () => {
  const play = vi.fn(); renderHook(() => useWorkspaceShortcuts({ onTogglePlay: play }));
  const editor = document.createElement("div"); editor.setAttribute("contenteditable", "true");
  const paragraph = document.createElement("p"); editor.append(paragraph); document.body.append(editor);
  fireEvent.keyDown(paragraph, { code: "KeyK" }); expect(play).not.toHaveBeenCalled();
});
it("seeks in both directions and clamps the start of the video", () => {
  useWorkspaceStore.getState().setCurrentTime(0);
  renderHook(() => useWorkspaceShortcuts());
  fireEvent.keyDown(window, { code: "KeyJ" });
  expect(useWorkspaceStore.getState().seekRequestedTime).toBe(0);
  fireEvent.keyDown(window, { code: "KeyL" });
  expect(useWorkspaceStore.getState().seekRequestedTime).toBe(5);
});
it.each([{ ctrlKey: true }, { metaKey: true }])("opens help with the platform modifier", modifier => {
  const { result } = renderHook(() => useWorkspaceShortcuts());
  fireEvent.keyDown(window, { code: "Slash", ...modifier });
  expect(result.current.isHelpOpen).toBe(true);
});
it("does not open shortcut help when the shortcut panel is disabled", () => {
  act(() => useWorkspaceStore.getState().setShowShortcutPanel(false));
  const { result } = renderHook(() => useWorkspaceShortcuts());
  fireEvent.keyDown(window, { code: "Slash", ctrlKey: true });
  fireEvent.keyDown(window, { key: "?" });
  expect(result.current.isHelpOpen).toBe(false);
});
it("closes shortcut help when its setting is disabled", async () => {
  const { result } = renderHook(() => useWorkspaceShortcuts());
  fireEvent.keyDown(window, { code: "Slash", ctrlKey: true });
  expect(result.current.isHelpOpen).toBe(true);
  act(() => useWorkspaceStore.getState().setShowShortcutPanel(false));
  expect(useWorkspaceStore.getState().isShortcutPanelOpen).toBe(false);
  await waitFor(() => expect(result.current.isHelpOpen).toBe(false));
});

it.each([{ ctrlKey: true }, { metaKey: true }, { key: "Escape" }])("closes shortcut help using the keyboard", modifier => {
  const close = vi.fn();
  render(<ShortcutsModal isOpen onClose={close} />);
  fireEvent.keyDown(screen.getByRole("button", { name: "Close shortcuts modal" }), { code: "Slash", ...modifier });
  expect(close).toHaveBeenCalledOnce();
});
