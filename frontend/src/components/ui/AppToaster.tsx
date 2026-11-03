import React from "react";
import { Toaster as SonnerToaster } from "sonner";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

export const AppToaster: React.FC = () => {
  return (
    <SonnerToaster
      position="bottom-right"
      expand={false}
      visibleToasts={4}
      closeButton
      duration={4500}
      gap={10}
      toastOptions={{
        style: {
          width: "min(420px, calc(100vw - 24px))",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "1rem",
          color: "#0f172a",
          fontSize: "0.875rem",
          boxShadow: "0 18px 40px -18px rgba(15, 23, 42, 0.28), 0 4px 10px -6px rgba(15, 23, 42, 0.12)",
          padding: "0.875rem 3rem 0.875rem 1rem",
          fontFamily: "Poppins, system-ui, -apple-system, sans-serif",
        },
        classNames: {
          toast: "items-start gap-3",
          title: "break-words text-sm font-semibold leading-5 text-slate-900",
          description: "mt-1 break-words text-xs leading-relaxed text-slate-600",
          closeButton:
            "!absolute !left-auto !right-3 !top-3 !h-7 !w-7 !transform-none flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          actionButton:
            "min-h-10 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer",
          cancelButton:
            "min-h-10 rounded-lg bg-slate-100 px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 cursor-pointer",
        },
      }}
      icons={{
        success: <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />,
        info: <Info aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-600" />,
        warning: <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-700" />,
        error: <XCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600" />,
      }}
    />
  );
};
