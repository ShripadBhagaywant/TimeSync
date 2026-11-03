import { useLoadingStore } from "@/lib/loadingStore";
import { BrandLoader } from "./BrandLoader";

export const GlobalLoader = () => {
  const { isLoading, title, message, showBackdrop } = useLoadingStore();

  if (!isLoading) return null;

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px] ${showBackdrop ? "pointer-events-auto" : "pointer-events-none"}`}>
      <BrandLoader variant="card" size="lg" title={title} message={message} className="shadow-2xl shadow-slate-900/20" />
    </div>
  );
};
