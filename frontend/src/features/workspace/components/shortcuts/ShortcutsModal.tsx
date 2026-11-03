import React, { useEffect, useRef, useMemo } from "react";
import { Keyboard, X } from "lucide-react";

interface ShortcutItem {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isMac = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }, []);

  const shortcutGroups: ShortcutGroup[] = useMemo(() => {
    const mod = isMac ? "⌘" : "Ctrl";
    return [
      {
        title: "Editor & Text Formatting",
        shortcuts: [
          { keys: ["Alt", "N"], label: "Insert video timestamp" },
          { keys: [mod, "B"], label: "Toggle bold text" },
          { keys: [mod, "I"], label: "Toggle italic text" },
          { keys: [mod, "U"], label: "Toggle underline" },
          { keys: [mod, "Shift", "H"], label: "Toggle text highlight" },
          { keys: [mod, "Alt", "1"], label: "Apply Heading 1" },
          { keys: [mod, "Alt", "2"], label: "Apply Heading 2" },
          { keys: [mod, "Shift", "8"], label: "Toggle bullet list" },
          { keys: [mod, "Shift", "7"], label: "Toggle numbered list" },
          { keys: [mod, "Alt", "C"], label: "Toggle code block" },
          { keys: [mod, "Shift", "L"], label: "Align text left" },
          { keys: [mod, "Shift", "E"], label: "Align text center" },
          { keys: [mod, "Shift", "R"], label: "Align text right" },
          { keys: [mod, "Z"], label: "Undo change" },
          { keys: [mod, "Shift", "Z"], label: "Redo change" },
        ],
      },
      { title: "Transcript Import", shortcuts: [{ keys: [mod, "Enter"], label: "Parse pasted transcript" }] },
      {
        title: "Video Controls (Outside Editor)",
        shortcuts: [
          { keys: ["Space"], label: "Play / Pause" },
          { keys: ["K"], label: "Toggle playback" },
          { keys: ["J"], label: "Seek backward 5 seconds" },
          { keys: ["L"], label: "Seek forward 5 seconds" },
          { keys: ["Shift", "<"], label: "Decrease speed" },
          { keys: ["Shift", ">"], label: "Increase speed" },
          { keys: ["M"], label: "Mute / Unmute" },
          { keys: ["←", "→"], label: "Seek backward / forward 5 seconds" },
          { keys: [mod, "/"], label: "Open / close shortcuts dialog" },
          { keys: ["?"], label: "Open shortcuts dialog" },
        ],
      },
    ];
  }, [isMac]);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocusedElement = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || ((e.ctrlKey || e.metaKey) && e.code === "Slash")) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    closeButtonRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusedElement?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ux-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="ux-dialog relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/60">
              <Keyboard className="w-4 h-4" />
            </div>
            <h3
              id="shortcuts-modal-title"
              className="text-sm font-bold text-slate-800 tracking-tight"
            >
              Keyboard Shortcuts
            </h3>
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
            aria-label="Close shortcuts modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 max-h-[65vh] overflow-y-auto space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {group.title}
              </h4>

              <div className="space-y-2">
                {group.shortcuts.map((sc, idx) => (
                  <div
                    key={`${sc.label}-${idx}`}
                    className="flex items-center justify-between gap-4 py-1 text-xs"
                  >
                    <span className="text-slate-600 font-medium truncate">
                      {sc.label}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      {sc.keys.map((key, keyIdx) => (
                        <kbd
                          key={keyIdx}
                          className="min-w-[24px] h-6 px-1.5 inline-flex items-center justify-center bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-md border border-slate-200 shadow-2xs"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>
            Press{" "}
            <kbd className="px-1 py-0.5 text-[10px] bg-slate-200/60 rounded border border-slate-300/60 font-medium text-slate-600">
              Esc
            </kbd>{" "}
            to exit
          </span>
          <span className="font-medium text-slate-400">Workspace Controls</span>
        </div>
      </div>
    </div>
  );
};
