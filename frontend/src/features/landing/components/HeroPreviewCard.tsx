import React, { useEffect, useState } from "react";
import {
  Play,
  Pause,
  Clock,
  Sparkles,
  CheckCircle2,
  HardDrive,
  FileText,
  Volume2,
  Maximize2,
  BookOpen,
} from "lucide-react";

interface TimestampChapter {
  seconds: number;
  title: string;
  description: string;
}

const DURATION_SECONDS = 24 * 60 + 15;
const CHAPTERS: readonly TimestampChapter[] = [
  { seconds: 10 * 60 + 43, title: "Understanding the main idea", description: "Capture the main idea and explain it in your own words." },
  { seconds: 18 * 60 + 10, title: "Putting ideas into practice", description: "Connect a useful example to what you have learned." },
  { seconds: 24 * 60 + 10, title: "Review and export your notes", description: "Bring your key takeaways together and export your finished notes." },
];
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export const HeroPreviewCard: React.FC = () => {
  const [position, setPosition] = useState(CHAPTERS[0]!.seconds);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeIndex = CHAPTERS.reduce((active, chapter, index) => chapter.seconds <= position ? index : active, -1);
  const activeChapter = CHAPTERS[activeIndex];
  const playing = isPlaying && position < DURATION_SECONDS;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPosition(current => Math.min(DURATION_SECONDS, current + 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [playing]);

  const seek = (seconds: number) => {
    setPosition(Math.max(0, Math.min(DURATION_SECONDS, seconds)));
    if (position === DURATION_SECONDS || seconds >= DURATION_SECONDS) setIsPlaying(false);
  };
  const togglePlayback = () => {
    if (position === DURATION_SECONDS) {
      setPosition(0);
      setIsPlaying(true);
    } else setIsPlaying(current => !current);
  };

  return (
    <div className="relative w-full max-w-xl sm:max-w-none mx-auto select-none">
      {/* Decorative Glow Elements */}
      <div className="absolute -top-10 -left-10 w-56 h-56 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-56 h-56 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      {/* Main Container Window */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xl shadow-slate-300/50 relative overflow-hidden">
        {/* Mock Window Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80 shadow-xs" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80 shadow-xs" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80 shadow-xs" />
            </div>
            <span className="ml-2 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] hidden sm:inline-block shadow-xs">
              TimeSync workspace preview
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-500 font-medium text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold text-[10px] sm:text-[11px] shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Interactive preview
            </span>
          </div>
        </div>

        {/* Dual Panel Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
          {/* Left Panel: Refined Dark/Indigo Video Player */}
          <div className="sm:col-span-5 min-w-0 flex flex-col justify-between bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/80 p-3 rounded-xl border border-slate-800 text-white shadow-inner space-y-2.5">
            {/* Aspect Video Wrapper */}
            <div
              className={
                "relative aspect-video sm:aspect-auto sm:h-44 lg:h-48 bg-slate-950/90 rounded-lg overflow-hidden border border-slate-800 mt-1 flex flex-col justify-between p-2.5 group " +
                (playing ? "hero-preview-playing" : "")
              }
            >
              <div
                aria-hidden="true"
                className="hero-preview-art pointer-events-none absolute inset-0 z-[1] overflow-hidden"
              >
                <svg
                  viewBox="0 0 360 180"
                  preserveAspectRatio="xMidYMid meet"
                  className="h-full w-full"
                >
                  <defs>
                    <radialGradient id="heroPreviewGlow">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity=".3" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient
                      id="heroPreviewCard"
                      x1="0"
                      x2="1"
                      y1="0"
                      y2="1"
                    >
                      <stop stopColor="#1e3a8a" stopOpacity=".82" />
                      <stop offset="1" stopColor="#0f172a" stopOpacity=".92" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="180"
                    cy="91"
                    r="76"
                    fill="url(#heroPreviewGlow)"
                  />
                  <g
                    fill="none"
                    stroke="#93c5fd"
                    strokeOpacity=".35"
                    strokeWidth="1.2"
                  >
                    <path d="M101 91h43m72 0h43M180 49v-9m0 101v-9" />
                    <path
                      d="m104 63 34 17m84 22 34 17m-118 0 34-17m50-22 34-17"
                      strokeDasharray="3 5"
                    />
                  </g>
                  <g
                    className="hero-preview-orbit"
                    fill="none"
                    stroke="#60a5fa"
                    strokeOpacity=".55"
                  >
                    <circle cx="180" cy="91" r="39" strokeDasharray="2 7" />
                    <circle
                      cx="180"
                      cy="52"
                      r="3"
                      fill="#bfdbfe"
                      stroke="none"
                    />
                    <circle
                      cx="214"
                      cy="110"
                      r="2.5"
                      fill="#818cf8"
                      stroke="none"
                    />
                    <circle
                      cx="146"
                      cy="110"
                      r="2.5"
                      fill="#38bdf8"
                      stroke="none"
                    />
                  </g>
                  <g className="hero-preview-drift">
                    <rect
                      x="53"
                      y="66"
                      width="49"
                      height="42"
                      rx="7"
                      fill="url(#heroPreviewCard)"
                      stroke="#60a5fa"
                      strokeOpacity=".55"
                    />
                    <path
                      d="M63 78h23M63 84h29M63 90h18"
                      stroke="#bfdbfe"
                      strokeOpacity=".72"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="92" cy="97" r="3" fill="#34d399" />
                  </g>
                  <g className="hero-preview-drift hero-preview-drift-late">
                    <rect
                      x="258"
                      y="68"
                      width="49"
                      height="39"
                      rx="7"
                      fill="url(#heroPreviewCard)"
                      stroke="#818cf8"
                      strokeOpacity=".6"
                    />
                    <path
                      d="M268 79h28M268 85h19"
                      stroke="#c7d2fe"
                      strokeOpacity=".68"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="m282 92 2 4 4 1-4 2-2 4-2-4-4-2 4-1z"
                      fill="#fbbf24"
                    />
                  </g>
                  <circle
                    className="hero-preview-pulse"
                    cx="180"
                    cy="91"
                    r="31"
                    fill="none"
                    stroke="#bfdbfe"
                    strokeOpacity=".55"
                  />
                  <text
                    x="180"
                    y="91"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#e0f2fe"
                    fontSize="9.5"
                    fontWeight="500"
                    letterSpacing="1"
                  >
                    TimeSync
                  </text>
                </svg>
              </div>
              <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-slate-950/60 pointer-events-none" />

              {/* Video Overlay Top Bar */}
              <div className="relative z-10 flex items-center justify-between min-w-0 gap-1">
                <span className="px-1.5 py-0.5 bg-red-600/90 text-white font-medium rounded text-[9px] tracking-wider flex-shrink-0">
                  YouTube
                </span>
                <span className="text-[10px] text-slate-200 bg-slate-950/80 px-1 py-0.5 rounded backdrop-blur-xs border border-slate-800 truncate">
                  {formatTime(position)} / {formatTime(DURATION_SECONDS)}
                </span>
              </div>

              {/* Center Play and Pause Controls */}
              {!playing && (
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="relative mt-9 self-center z-10 my-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white shadow-lg backdrop-blur-md transition-transform duration-200 hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-11 sm:w-11 cursor-pointer"
                  aria-label="Play preview"
                  aria-pressed="false"
                  title="Play preview"
                >
                  <Play
                    aria-hidden="true"
                    className="h-5 w-5 fill-current translate-x-0.5 text-white"
                  />
                </button>
              )}

              {/* Video Controls Bar */}
              <div className="relative z-10 space-y-1.5 pt-1">
                <input
                  type="range"
                  aria-label="Preview playback position"
                  aria-valuetext={`${formatTime(position)} of ${formatTime(DURATION_SECONDS)}`}
                  min={0}
                  max={DURATION_SECONDS}
                  step={1}
                  value={position}
                  onChange={(event) => seek(Number(event.target.value))}
                  className="block h-5 w-full cursor-pointer accent-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Volume2 className="w-3 h-3 text-slate-300" />
                    <span>Demo only</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {playing && (
                      <button
                        type="button"
                        onClick={togglePlayback}
                        className="flex items-center  gap-1 text-slate-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
                        aria-label="Pause preview"
                        aria-pressed="true"
                        title="Pause preview"
                      >
                        <Pause
                          aria-hidden="true"
                          className="h-3 w-3 fill-current"
                        />
                        <span>Pause</span>
                      </button>
                    )}
                    <Maximize2 className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Video Metadata & Chapter Header */}
            <div className="space-y-1.5 text-left px-0.5 pt-1">
              <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-semibold">
                <Sparkles className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Your learning video</span>
              </div>

              <h4 className="text-xs font-semibold text-slate-100 truncate mb-2">
                {activeChapter?.title ?? "Video introduction"}
              </h4>

              {/* Structured Chapter Badge */}
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/90 border border-slate-700/80 text-indigo-300 text-[10px] font-medium">
                <BookOpen className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                <span className="truncate">Active Chapter View</span>
              </div>
            </div>
          </div>

          {/* Right Panel: Interactive Notes Editor Preview */}
          <div className="sm:col-span-7 min-w-0 flex flex-col justify-between bg-slate-50/90 p-3 rounded-xl border border-slate-200/80 text-left space-y-2.5">
            {/* Editor Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 text-slate-500 text-[11px]">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Your notes</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <HardDrive className="w-3 h-3" />
                <span>Sample draft</span>
              </div>
            </div>

            {/* Chapter Selection Notes List */}
            <div className="space-y-1.5 flex-1">
              {CHAPTERS.map((chapter, index) => (
                <button
                  key={chapter.seconds}
                  type="button"
                  onClick={() => seek(chapter.seconds)}
                  aria-label={`${formatTime(chapter.seconds)} ${chapter.title}`}
                  aria-pressed={index === activeIndex}
                  className={`block w-full min-w-0 p-2 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    index === activeIndex
                      ? "bg-blue-50/90 border-blue-300 shadow-xs ring-1 ring-blue-200"
                      : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/50"
                  }`}
                >
                  <span className="flex items-start gap-1.5 mb-1">
                    <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-bold font-mono shrink-0">
                      {formatTime(chapter.seconds)}
                    </span>
                    <span className="min-w-0 flex-1 text-[11px] font-bold text-slate-800 leading-snug">
                      {chapter.title}
                    </span>
                    {index === activeIndex && (
                      <CheckCircle2
                        aria-hidden="true"
                        className="w-3.5 h-3.5 text-blue-600 shrink-0"
                      />
                    )}
                  </span>
                  <span className="block text-[11px] text-slate-600 leading-snug">
                    {chapter.description}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick-Jump Footer */}
            <div className="mt-1 pt-2 border-t border-slate-200/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Current Position */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 border border-blue-100">
                    <Clock className="w-3 h-3 text-blue-600" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide leading-none">
                      Current Position: {formatTime(position)}
                    </p>
                  </div>
                </div>

                {/* Quick Jump Action */}
                <button
                  type="button"
                  onClick={() =>
                    seek(CHAPTERS[(activeIndex + 1) % CHAPTERS.length]!.seconds)
                  }
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                            bg-white border border-slate-200
                            text-[10px] font-semibold text-slate-600
                            shadow-sm
                            transition-all duration-200
                            hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-600
                            active:scale-[0.97]
                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  aria-label="Jump to next chapter"
                  title="Jump to next chapter"
                >
                  <span>Quick Jump</span>
                  <span className="text-slate-300 group-hover:text-blue-400">
                    →
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
