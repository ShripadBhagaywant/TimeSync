import { useDialogFocus } from "@/components/ui/useDialogFocus";
// src/features/workspace/components/chapters/AddChapterDialog.tsx
import React, { useState } from "react";
import { X, Clock } from "lucide-react";

interface AddChapterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
  currentTimeFormatted: string;
}

export const AddChapterDialog: React.FC<AddChapterDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  currentTimeFormatted,
}) => {
  const [title, setTitle] = useState("");

  const handleClose = () => {
    setTitle("");
    onClose();
  };

  const panelRef = useDialogFocus<HTMLDivElement>(isOpen, handleClose);
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(title.trim());
      handleClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 transition-opacity"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Add custom chapter" tabIndex={-1} className="ux-dialog fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800">
            Add Custom Chapter
          </h3>
          <button
            aria-label="Close chapter dialog"
            onClick={handleClose}
            className="inline-flex h-11 w-11 items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
            <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Capture Time:
            </span>
            <span className="text-sm text-blue-700 font-bold">
              {currentTimeFormatted}
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="chapter-title"
              className="text-xs font-semibold text-slate-600 px-1"
            >
              Chapter Title
            </label>
            <input
              id="chapter-title"
              type="text"
              data-dialog-autofocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Introduction to React..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-11 flex-1 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="min-h-11 flex-1 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Save Chapter
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
