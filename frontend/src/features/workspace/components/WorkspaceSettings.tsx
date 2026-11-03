import type { EditorDisplayMode } from "./editor/editorFormatting";
import { useShallow } from "zustand/react/shallow";
import { Home, X } from "lucide-react";
import { useWorkspaceStore } from "../store/workspaceStore";
import { useDialogFocus } from "@/components/ui/useDialogFocus";

interface WorkspaceSettingsProps {
  editorDisplayMode?: EditorDisplayMode;
  onEditorDisplayModeChange?: (mode: EditorDisplayMode) => void;
  isOpen: boolean;
  onClose: () => void;
  onHome: () => void;
}

interface SettingSwitchProps {
  label: string;
  description: string;
  checked: boolean;
  activeColor: string;
  onChange: () => void;
}

function SettingSwitch({
  label,
  description,
  checked,
  activeColor,
  onChange,
}: SettingSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-800">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className={"relative h-6 w-11 shrink-0 rounded-full transition-colors " + (checked ? activeColor : "bg-slate-300")}
      >
        <span
          className={"absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform " + (checked ? "translate-x-6" : "translate-x-1")}
        />
      </span>
    </button>
  );
}

export function WorkspaceSettings({
  isOpen,
  onClose,
  onHome,
  editorDisplayMode = "normal",
  onEditorDisplayModeChange,
}: WorkspaceSettingsProps) {
  const panelRef = useDialogFocus<HTMLDivElement>(isOpen, onClose);
  const {
    autoSaveEnabled,
    setAutoSaveEnabled,
    showTranscriptTimestamps,
    setShowTranscriptTimestamps,
    showShortcutPanel,
    setShowShortcutPanel,
  } = useWorkspaceStore(
    useShallow((state) => ({
      autoSaveEnabled: state.autoSaveEnabled,
      setAutoSaveEnabled: state.setAutoSaveEnabled,
      showTranscriptTimestamps: state.showTranscriptTimestamps,
      setShowTranscriptTimestamps: state.setShowTranscriptTimestamps,
      showShortcutPanel: state.showShortcutPanel,
      setShowShortcutPanel: state.setShowShortcutPanel,
    })),
  );

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-settings-title"
      tabIndex={-1}
      className="ux-dialog absolute right-2 top-[calc(100%+0.5rem)] z-40 w-[min(19rem,calc(100vw-1rem))] rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 shadow-xl sm:right-3 md:right-4 lg:right-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2
            id="workspace-settings-title"
            className="text-sm font-semibold text-slate-900"
          >
            Workspace settings
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Display and saving preferences
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onHome}
            aria-label="Return to Home"
            title="Go home; your draft is not cleared"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
          >
            <Home aria-hidden="true" className="h-4 w-4" />
            <span className="text-xs font-semibold">Home</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close workspace settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {onEditorDisplayModeChange && (
          <fieldset className="rounded-xl border border-slate-200 bg-white p-2.5">
            <legend className="px-1 text-[11px] font-semibold text-slate-700">
              Editor size
            </legend>
            <p className="mb-2 px-1 text-[10px] leading-relaxed text-slate-500">
              Choose how much room notes use.
            </p>
            <div
              role="group"
              aria-label="Editor size"
              className="grid grid-cols-3 gap-1"
            >
              {(["normal", "minimized", "maximized"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={editorDisplayMode === mode}
                  onClick={() => {
                    onEditorDisplayModeChange(mode);
                    onClose();
                  }}
                  className={
                    "min-h-10 rounded-lg px-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " +
                    (editorDisplayMode === mode
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                  }
                >
                  {mode === "normal"
                    ? "Restore"
                    : mode === "minimized"
                      ? "Minimize"
                      : "Maximize"}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <SettingSwitch
          label="Auto-save notes"
          description="Save your latest edits on this device."
          checked={autoSaveEnabled}
          activeColor="bg-emerald-500"
          onChange={() => setAutoSaveEnabled(!autoSaveEnabled)}
        />
        <SettingSwitch
          label="Transcript timestamps"
          description="Show time beside transcript text."
          checked={showTranscriptTimestamps}
          activeColor="bg-blue-600"
          onChange={() =>
            setShowTranscriptTimestamps(!showTranscriptTimestamps)
          }
        />
        <SettingSwitch
          label="Show shortcut panel"
          description="shortcut panel to open CTRL+?"
          checked={showShortcutPanel}
          activeColor="bg-blue-600"
          onChange={() => setShowShortcutPanel(!showShortcutPanel)}
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 min-h-11 w-full rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
      >
        Done
      </button>
    </div>
  );
}
