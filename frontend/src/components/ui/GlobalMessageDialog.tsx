import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, X, XCircle } from "lucide-react";
import { useDialogFocus } from "@/components/ui/useDialogFocus";

export interface GlobalDialogMessage {
  title: string;
  description?: string;
  variant: "warning" | "error";
}
const MESSAGE_EVENT = "timesync:global-message-dialog";

export const GlobalMessageDialog = () => {
  const [messages, setMessages] = useState<GlobalDialogMessage[]>([]);
  const closeCurrent = useCallback(
    () => setMessages((current) => current.slice(1)),
    [],
  );
  const panelRef = useDialogFocus(messages.length > 0, closeCurrent);

  useEffect(() => {
    const receiveMessage = (event: Event) => {
      const message = (event as CustomEvent<GlobalDialogMessage>).detail;
      if (message?.title) setMessages((current) => [...current, message]);
    };
    window.addEventListener(MESSAGE_EVENT, receiveMessage);
    return () => window.removeEventListener(MESSAGE_EVENT, receiveMessage);
  }, []);

  const message = messages[0];
  if (!message) return null;
  const isError = message.variant === "error";
  const Icon = isError ? XCircle : AlertTriangle;
  const iconAccent = isError
    ? "bg-rose-50 text-rose-600"
    : "bg-amber-50 text-amber-700";
  const buttonAccent = isError
    ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-300"
    : "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-300";

  return (
    <div
      className="ux-overlay fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeCurrent();
      }}
    >
      <section
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="global-message-title"
        aria-describedby={
          message.description ? "global-message-description" : undefined
        }
        tabIndex={-1}
        className="ux-dialog w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-4 p-4">
          <div
            className={
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl " +
              iconAccent
            }
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="global-message-title"
              className="text-sm font-semibold text-slate-900"
            >
              {message.title}
            </h2>
            {message.description && (
              <p
                id="global-message-description"
                className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600"
              >
                {message.description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close message"
            onClick={closeCurrent}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-4 py-3">
          <button
            type="button"
            data-dialog-autofocus
            onClick={closeCurrent}
            className={
              "min-h-11 min-w-24 rounded-2xl px-4 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
              buttonAccent
            }
          >
            Got it
          </button>
        </div>
      </section>
    </div>
  );
};
