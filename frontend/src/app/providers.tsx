import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { queryClient } from "@/lib/queryClient";
import { sanitizeAnalyticsEvent } from "@/lib/analytics";
import { AppToaster } from "@/components/ui/AppToaster";
import { GlobalLoader } from "@/components/ui/GlobalLoader";
import { GlobalMessageDialog } from "@/components/ui/GlobalMessageDialog";

interface ProvidersProps {
  children: React.ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <GlobalLoader />
      <GlobalMessageDialog />
      <AppToaster />
      <Analytics beforeSend={sanitizeAnalyticsEvent} />
    </QueryClientProvider>
  );
};
