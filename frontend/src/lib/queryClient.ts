import { shouldRetryExtraction } from "@/features/extraction/utils/extractionErrors";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 Minutes
      refetchOnWindowFocus: false,
      retry: shouldRetryExtraction,
    },
  },
});
