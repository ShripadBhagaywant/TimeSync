import { Activity } from "react";
import { ChaptersDrawer } from "./chapters/ChaptersDrawer";
import { YouTubeSyncPlayer } from "./player/YouTubeSyncPlayer";
import { InteractiveTranscript } from "./transcript/InteractiveTranscript";
import { VideoInfoPanel } from "./info/VideoInfoPanel";
import { List, Info, Layers } from "lucide-react";

export type SourceTab = "transcript" | "info" | "chapters";
interface Props { videoId: string; leftTab: SourceTab; setLeftTab: (tab: SourceTab) => void; onImportTranscript: () => void; }
export function WorkspaceSourcePanel({ videoId, leftTab, setLeftTab, onImportTranscript }: Props) {
  return <>
            <div className="workspace-player-shell mx-auto w-full min-w-0 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-xs">
              <YouTubeSyncPlayer
                videoId={videoId}
              />
            </div>

            <div className="workspace-source-card min-w-0 flex-1 basis-0 flex flex-col overflow-hidden border border-slate-200 bg-white shadow-xs rounded-2xl">
              <div className="flex items-center border-b border-slate-200 bg-slate-50 p-1 gap-1 shrink-0">
                <button
                  aria-pressed={leftTab === "transcript"}
                  onClick={() => setLeftTab("transcript")}
                  className={`flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    leftTab === "transcript"
                      ? "bg-white text-blue-600 shadow-xs border border-slate-200/60 font-bold"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <List className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Transcript</span>
                </button>

                <button
                  aria-pressed={leftTab === "info"}
                  onClick={() => setLeftTab("info")}
                  className={`flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    leftTab === "info"
                      ? "bg-white text-blue-600 shadow-xs border border-slate-200/60 font-bold"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Video Info</span>
                </button>

                <button
                  aria-pressed={leftTab === "chapters"}
                  onClick={() => setLeftTab("chapters")}
                  className={`flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    leftTab === "chapters"
                      ? "bg-white text-blue-600 shadow-xs border border-slate-200/60 font-bold"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Chapters</span>
                </button>
              </div>

              <div className="flex-1 basis-0 min-h-0 overflow-hidden">
                <Activity key={videoId} mode={leftTab === "transcript" ? "visible" : "hidden"}>
                  <InteractiveTranscript
                    onPasteTranscript={onImportTranscript}
                  />
                </Activity>
                {leftTab === "info" && <VideoInfoPanel />}
                {leftTab === "chapters" && <ChaptersDrawer />}
              </div>
            </div>

  </>;
}
