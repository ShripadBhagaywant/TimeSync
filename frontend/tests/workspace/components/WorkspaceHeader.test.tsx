// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkspaceHeader } from "@/features/workspace/components/WorkspaceHeader";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
import { createPlaylistNoteDocument } from "@/features/workspace/utils/playlistNoteDocument";

const props = { currentTitle: "Notes", saveStatus: "idle" as const, isSharing: false, handleSnapshot: vi.fn(), handleShareWorkspace: vi.fn(), onExport: vi.fn(), onHome: vi.fn() };
beforeEach(() => {
  localStorage.clear(); useWorkspaceStore.getState().resetWorkspace();
  useWorkspaceStore.getState().setAutoSaveEnabled(true);
  useWorkspaceStore.getState().setShowShortcutPanel(true);
});
afterEach(cleanup);
it("only claims a completed save when saving has succeeded", () => {
  const { rerender } = render(<WorkspaceHeader {...props} />);
  expect(screen.getByRole("status").textContent).toBe("Ready to save");
  rerender(<WorkspaceHeader {...props} saveStatus="saved" />);
  expect(screen.getByRole("status").textContent).toBe("Saved locally");
});
it("persists settings immediately and reports autosave being off", () => {
  render(<WorkspaceHeader {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Workspace settings" }));
  fireEvent.click(screen.getByRole("switch", { name: "Auto-save notes" }));
  expect(useWorkspaceStore.getState().autoSaveEnabled).toBe(false);
  expect(JSON.parse(localStorage.getItem("timesync-workspace-preferences-v2") ?? "{}").state.autoSaveEnabled).toBe(false);
  expect(screen.getByRole("status").textContent).toBe("Auto-save off");
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("persists the shortcut panel visibility preference", () => {
  render(<WorkspaceHeader {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Workspace settings" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show shortcut panel" }));
  expect(useWorkspaceStore.getState().showShortcutPanel).toBe(false);
  expect(JSON.parse(localStorage.getItem("timesync-workspace-preferences-v2") ?? "{}").state.showShortcutPanel).toBe(false);
});
it("renames the playlist document without replacing its notes", () => {
  useWorkspaceStore.getState().setPlaylistNoteDocument({ ...createPlaylistNoteDocument("course", "Course"), content: "<p>Keep these notes</p>" });
  render(<WorkspaceHeader {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit workspace title" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Workspace title" }), { target: { value: "New title" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(useWorkspaceStore.getState().playlistNoteDocument).toMatchObject({ title: "New title", content: "<p>Keep these notes</p>" });
});

it.each([["Minimize", "minimized"], ["Maximize", "maximized"], ["Restore", "normal"]] as const)(
  "changes editor size with %s from workspace settings", (label, mode) => {
    const onEditorDisplayModeChange = vi.fn();
    render(<WorkspaceHeader {...props} editorDisplayMode="normal" onEditorDisplayModeChange={onEditorDisplayModeChange} />);
    expect(screen.queryByRole("button", { name: label })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Workspace settings" }));
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(onEditorDisplayModeChange).toHaveBeenCalledWith(mode);
    expect(screen.queryByRole("dialog")).toBeNull();
  },
);
