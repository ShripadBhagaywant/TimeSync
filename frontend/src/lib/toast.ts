import { toast as sonnerToast } from "sonner";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

type GlobalDialogMessage = {
  title: string;
  description?: string;
  variant: "warning" | "error";
};

const showGlobalDialog = (message: GlobalDialogMessage) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("timesync:global-message-dialog", { detail: message }));
};

export const notify = {
  success: (title: string, description?: string) =>
    sonnerToast.success(title, { description }),

  error: (title: string, description?: string) =>
    showGlobalDialog({ title, description, variant: "error" }),

  errorToast: (title: string, description?: string) =>
    sonnerToast.error(title, { description, duration: 5000 }),

  warning: (title: string, description?: string) =>
    showGlobalDialog({ title, description, variant: "warning" }),

  warningToast: (title: string, description?: string) =>
    sonnerToast.warning(title, { description, duration: 5000 }),

  info: (title: string, description?: string) =>
    sonnerToast.info(title, { description }),

  action: (title: string, description: string, action: ToastAction) =>
    sonnerToast(title, {
      description,
      action: { label: action.label, onClick: action.onClick },
    }),
};
