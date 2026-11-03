type BrandLoaderSize = "xs" | "sm" | "md" | "lg";
type BrandLoaderVariant = "inline" | "card" | "page";
type BrandLoaderTone = "brand" | "inverse";

interface BrandLoaderProps {
  size?: BrandLoaderSize;
  variant?: BrandLoaderVariant;
  tone?: BrandLoaderTone;
  title?: string;
  message?: string;
  className?: string;
}

const markSizes: Record<BrandLoaderSize, string> = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-9 w-9",
  lg: "h-11 w-11",
};

const ClockSyncMark = ({ size, tone }: { size: BrandLoaderSize; tone: BrandLoaderTone }) => (
  <span className={`relative inline-flex shrink-0 items-center justify-center ${markSizes[size]}`} aria-hidden="true">
    <span className={`absolute inset-0 rounded-full border-2 ${tone === "inverse" ? "border-white/30" : "border-blue-100"}`} />
    <span className={`absolute inset-0 rounded-full border-2 border-transparent animate-spin ${tone === "inverse" ? "border-t-white border-r-cyan-200" : "border-t-blue-600 border-r-indigo-500"}`} />
    <svg viewBox="0 0 24 24" className={`relative h-[58%] w-[58%] ${tone === "inverse" ? "text-white" : "text-blue-700"}`} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7v5l3.2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  </span>
);

export const BrandLoader = ({
  size = "md",
  variant = "inline",
  tone = "brand",
  title,
  message,
  className = "",
}: BrandLoaderProps) => {
  const mark = <ClockSyncMark size={size} tone={tone} />;

  if (variant === "page" || variant === "card") {
    const containerClass = variant === "page"
      ? "flex min-h-screen items-center justify-center bg-slate-100 px-4"
      : "w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

    return (
      <div role="status" aria-live="polite" className={`${containerClass} ${className}`}>
        <div className={`flex items-center gap-3 ${variant === "page" ? "w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" : ""}`}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            {mark}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800">{title ?? "Loading"}</span>
            {message && <span className="mt-1 block text-xs leading-relaxed text-slate-500">{message}</span>}
          </span>
        </div>
      </div>
    );
  }

  return (
    <span
      role={title ? "status" : undefined}
      aria-label={title}
      aria-live={title ? "polite" : undefined}
      className={`inline-flex shrink-0 items-center gap-2 ${className}`}
    >
      {mark}
      {title && <span className="text-xs font-medium">{title}</span>}
    </span>
  );
};
