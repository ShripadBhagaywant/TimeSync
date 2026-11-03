import { Video, FileText } from "lucide-react";

interface Props { mobileTab: "left" | "right"; setMobileTab: (tab: "left" | "right") => void; }
export function WorkspaceMobileNav({ mobileTab, setMobileTab }: Props) {
  return (
    <div className="lg:hidden flex border-b rounded-lg border-slate-200 mt-2 ml-2 mr-2 bg-white p-1 px-2 gap-1 shrink-0">
          <button
            aria-pressed={mobileTab === "left"}
            onClick={() => setMobileTab("left")}
            className={`flex-1 min-h-7 py-0.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mobileTab === "left"
                ? "bg-blue-50 text-blue-600 shadow-xs"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Video className="w-3 h-3" />
            <span>Player & Details</span>
          </button>
          <button
            aria-pressed={mobileTab === "right"}
            onClick={() => setMobileTab("right")}
            className={`flex-1 min-h-7 py-0.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mobileTab === "right"
                ? "bg-blue-50 text-blue-600 shadow-xs"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Notes Editor</span>
          </button>
        </div>

);
}
