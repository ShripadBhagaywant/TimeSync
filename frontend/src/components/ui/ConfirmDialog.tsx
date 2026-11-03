import { useDialogFocus } from "@/components/ui/useDialogFocus";
import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles = {
  danger: {
    icon: "border-rose-100 bg-rose-50 text-rose-600",
    button: "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20",
  },
  warning: {
    icon: "border-amber-100 bg-amber-50 text-amber-700",
    button: "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20",
  },
  info: {
    icon: "border-blue-100 bg-blue-50 text-blue-600",
    button: "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20",
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}) => {
  const panelRef = useDialogFocus<HTMLDivElement>(isOpen, onCancel);
  if (!isOpen) return null;

  return (
    <div ref={panelRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description" tabIndex={-1}
      className="ux-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="ux-dialog w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start gap-3 p-4">
          <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border " + variantStyles[variant].icon}>
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="confirm-dialog-title" className="text-sm font-semibold text-slate-900">{title}</h2>
            <p id="confirm-dialog-description" className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
          </div>
          <button type="button" aria-label="Close confirmation" onClick={onCancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <button type="button" data-dialog-autofocus onClick={onCancel}
            className="min-h-11 rounded-xl px-3.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200/60">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm}
            className={"min-h-11 rounded-xl px-4 text-xs font-semibold text-white shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " + variantStyles[variant].button}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};