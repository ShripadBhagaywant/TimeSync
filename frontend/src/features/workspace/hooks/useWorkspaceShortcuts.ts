// src/features/workspace/hooks/useWorkspaceShortcuts.ts
import { sendPlayerCommand } from "../utils/playerCommands";
import { useEffect, useCallback } from "react";
import { useWorkspaceStore } from "../store/workspaceStore";

export interface ShortcutOptions {
  onInsertTimestamp?: () => void;
  onTogglePlay?: () => void;
  onToggleMute?: () => void;
  onChangeSpeed?: (delta: number) => void;
}

export const useWorkspaceShortcuts = (options: ShortcutOptions = {}) => {
  const { onInsertTimestamp, onTogglePlay, onToggleMute, onChangeSpeed } =
    options;
  const requestSeekTo = useWorkspaceStore(state => state.requestSeekTo);
  const showShortcutPanel = useWorkspaceStore(state => state.showShortcutPanel);
  const isHelpOpen = useWorkspaceStore(state => state.isShortcutPanelOpen);
  const setIsHelpOpen = useWorkspaceStore(state => state.setIsShortcutPanelOpen);

  const isUserEditing = useCallback((target: EventTarget | null): boolean => {
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), .ProseMirror, [role="textbox"]')) return true;
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName;
    const isInput =
      tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
    const isEditable = activeElement.getAttribute("contenteditable") === "true";
    const isProseMirror = activeElement.classList.contains("ProseMirror");

    return isInput || isEditable || isProseMirror;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isHelpOpen || event.defaultPrevented || event.isComposing) return;
      const target = event.target;
      if (target instanceof Element) {
        if (target.closest('[role="dialog"], dialog, a[href]')) return;
      }
      const isModifierActive = event.ctrlKey || event.metaKey;

      // Keep the help shortcut available from workspace tabs and controls.
      if (showShortcutPanel && isModifierActive && event.code === "Slash") {
        event.preventDefault();
        if (!event.repeat) setIsHelpOpen(!isHelpOpen);
        return;
      }

      if (target instanceof Element && target.closest('button') && (!target.closest('[aria-label="Video player"]') || event.code === "Space" || event.code === "Enter")) return;
      const isEditing = isUserEditing(target);

      // -------------------------------------------------------------
      // 1. GLOBAL SHORTCUTS
      // -------------------------------------------------------------

      // Alt + N -> Insert timestamp
      if (event.altKey && !isModifierActive && event.code === "KeyN") {
        if (isEditing && !(target instanceof Element && target.closest('[contenteditable]:not([contenteditable="false"]), .ProseMirror'))) return;
        event.preventDefault();
        if (!event.repeat) onInsertTimestamp?.();
        return;
      }

      // -------------------------------------------------------------
      // 2. NON-EDITING SHORTCUTS (Video Player Controls)
      // -------------------------------------------------------------
      if (isEditing || isModifierActive || event.altKey) return;

      // ? or Shift + / -> Toggle Shortcuts Modal
      if (showShortcutPanel && event.key === "?") {
        event.preventDefault();
        setIsHelpOpen(!isHelpOpen);
        return;
      }

      // Space or K -> Play / Pause
      if (event.code === "Space" || event.code === "KeyK") {
        event.preventDefault();
        if (!event.repeat) { if (onTogglePlay) onTogglePlay(); else sendPlayerCommand("toggle-play"); }
        return;
      }

      const playback = useWorkspaceStore.getState();
      const currentTime = playback.seekRequestedTime ?? playback.currentTime;

      // J -> Seek back 5s
      if (event.code === "KeyJ") {
        event.preventDefault();
        requestSeekTo(Math.max(0, currentTime - 5));
        return;
      }

      // L -> Seek forward 5s
      if (event.code === "KeyL") {
        event.preventDefault();
        requestSeekTo(currentTime + 5);
        return;
      }

      // Left Arrow -> Seek back 5s
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        requestSeekTo(Math.max(0, currentTime - 5));
        return;
      }

      // Right Arrow -> Seek forward 5s
      if (event.code === "ArrowRight") {
        event.preventDefault();
        requestSeekTo(currentTime + 5);
        return;
      }

      // M -> Mute / Unmute
      if (event.code === "KeyM") {
        event.preventDefault();
        if (!event.repeat) { if (onToggleMute) onToggleMute(); else sendPlayerCommand("toggle-mute"); }
        return;
      }

      // Shift + > -> Increase Speed
      if (event.shiftKey && (event.key === ">" || event.code === "Period")) {
        event.preventDefault();
        if (onChangeSpeed) onChangeSpeed(0.25); else sendPlayerCommand("speed-up");
        return;
      }

      // Shift + < -> Decrease Speed
      if (event.shiftKey && (event.key === "<" || event.code === "Comma")) {
        event.preventDefault();
        if (onChangeSpeed) onChangeSpeed(-0.25); else sendPlayerCommand("speed-down");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    requestSeekTo,
    showShortcutPanel,
    isHelpOpen,
    setIsHelpOpen,
    onInsertTimestamp,
    onTogglePlay,
    onToggleMute,
    onChangeSpeed,
    isUserEditing,
  ]);

  return { isHelpOpen, setIsHelpOpen };
};
