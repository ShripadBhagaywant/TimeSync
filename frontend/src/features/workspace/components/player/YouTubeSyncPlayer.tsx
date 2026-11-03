import { PLAYER_COMMAND_EVENT, sendPlayerCommand, type PlayerCommand } from "../../utils/playerCommands";
import React, { useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { Play, Pause, Volume2, VolumeX, RotateCcw, RotateCw, Minus, Plus } from "lucide-react";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { useShallow } from "zustand/react/shallow";

interface YouTubeSyncPlayerProps {
  videoId: string;
}

interface YouTubePlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration?: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getPlayerState: () => number;
  isMuted: () => boolean;
  mute: () => void;
  unMute: () => void;
  getPlaybackRate: () => number;
  getAvailablePlaybackRates: () => number[];
  setPlaybackRate: (rate: number) => void;
}

interface YouTubePlayerStateEvent {
  data: number;
}

interface YouTubeNamespace {
  Player: new (
    elementId: string,
    options: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: () => void;
        onError?: () => void;
        onPlaybackRateChange?: () => void;
        onStateChange: (event: YouTubePlayerStateEvent) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    PLAYING: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const Player: React.FC<YouTubeSyncPlayerProps> = ({
  videoId,
}) => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { currentTime, setCurrentTime, seekRequestedTime, clearSeekRequest } =
    useWorkspaceStore(useShallow((state) => ({
      currentTime: state.currentTime,
      setCurrentTime: state.setCurrentTime,
      seekRequestedTime: state.seekRequestedTime,
      clearSeekRequest: state.clearSeekRequest,
    })));

  useEffect(() => {
    let isMounted = true;
    let restoreApiCallback = () => {};
    setCurrentTime(0);
    const loadTimer = setTimeout(() => { if (isMounted && !readyRef.current) setFailed(true); }, 20000);

    const stopTracking = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const updateCurrentTime = () => {
      const player = playerRef.current;
      if (!isMounted || !readyRef.current || !player) return;
      setMuted(player.isMuted());
      setRate(player.getPlaybackRate());
      const time = player.getCurrentTime();
      if (typeof time === "number" && Number.isFinite(time)) {
        if (useWorkspaceStore.getState().currentTime !== time) setCurrentTime(time);
      }
    };

    const startTracking = () => {
      stopTracking();
      intervalRef.current = setInterval(updateCurrentTime, 500);
    };

    const initPlayer = () => {
      if (!isMounted || !window.YT?.Player) return;

      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player("yt-player-" + videoId, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => { if (isMounted) { readyRef.current = true; setReady(true); setFailed(false); clearTimeout(loadTimer); updateCurrentTime(); startTracking(); } },
          onError: () => { if (isMounted) { readyRef.current = false; setReady(false); setFailed(true); stopTracking(); } },
          onPlaybackRateChange: updateCurrentTime,
          onStateChange: (event) => {
            if (!isMounted) return;
            setPlaying(event.data === window.YT?.PlayerState.PLAYING);
            if (event.data === window.YT?.PlayerState.PLAYING) {
              startTracking();
            } else {
              updateCurrentTime();
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const previousCallback = window.onYouTubeIframeAPIReady;
      const callback = () => {
        previousCallback?.();
        initPlayer();
      };
      window.onYouTubeIframeAPIReady = callback;
      restoreApiCallback = () => { if (window.onYouTubeIframeAPIReady === callback) window.onYouTubeIframeAPIReady = previousCallback; };

      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      );
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
      restoreApiCallback();
      clearTimeout(loadTimer);
      readyRef.current = false;
      stopTracking();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, setCurrentTime]);

  useEffect(() => {
    const handleCommand = (event: Event) => {
      const player = playerRef.current;
      if (!player || !readyRef.current) return;
      const command = (event as CustomEvent<PlayerCommand>).detail;
      if (command === "toggle-play") {
        const wasPlaying = player.getPlayerState() === window.YT?.PlayerState.PLAYING;
        if (wasPlaying) player.pauseVideo(); else player.playVideo();
        setPlaying(!wasPlaying);
      } else if (command === "toggle-mute") {
        const wasMuted = player.isMuted();
        if (wasMuted) player.unMute(); else player.mute();
        setMuted(!wasMuted);
      } else if (command === "speed-up" || command === "speed-down") {
        const current = player.getPlaybackRate();
        const rates = player.getAvailablePlaybackRates().filter(Number.isFinite).sort((a, b) => a - b);
        const next = command === "speed-up" ? rates.find(rate => rate > current)
          : rates.reverse().find(rate => rate < current);
        if (next !== undefined) { player.setPlaybackRate(next); setRate(next); }
      }
    };
    window.addEventListener(PLAYER_COMMAND_EVENT, handleCommand);
    return () => window.removeEventListener(PLAYER_COMMAND_EVENT, handleCommand);
  }, []);

  useEffect(() => {
    if (seekRequestedTime === null || !ready || !readyRef.current) return;

    const player = playerRef.current;
    if (player) {
      const duration = player.getDuration?.();
      const target = Math.max(0, duration && duration > 0 ? Math.min(seekRequestedTime, duration) : seekRequestedTime);
      player.seekTo(target, true);
      setCurrentTime(target);
      player.playVideo();
    }
    clearSeekRequest();
  }, [ready, seekRequestedTime, clearSeekRequest, setCurrentTime]);

  const buttonClass = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40";
  const timeLabel = new Date(Math.max(0, currentTime) * 1000).toISOString().slice(currentTime >= 3600 ? 11 : 14, 19);
  return (<section aria-label="Video player" className="w-full min-w-0 bg-white">
    <div className="relative w-full aspect-video bg-black overflow-hidden shadow-xs [&>iframe]:w-full [&>iframe]:h-full">
      <div id={"yt-player-" + videoId} className="w-full h-full" />
      {!ready && <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/80 p-4 text-center text-sm text-white">{failed ? "This video could not be loaded." : <><BrandLoader size="sm" tone="inverse" />Loading video…</>}</div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-x-1 border-t border-slate-200 px-2 py-1">
      <div className="flex items-center" role="group" aria-label="Playback controls">
        <button type="button" disabled={!ready} aria-label="Back 5 seconds" title="Back 5 seconds (J / ←)" className={buttonClass} onClick={() => useWorkspaceStore.getState().requestSeekTo(Math.max(0, useWorkspaceStore.getState().currentTime - 5))}><RotateCcw className="h-4 w-4" /></button>
        <button type="button" disabled={!ready} aria-label={playing ? "Pause video" : "Play video"} title="Play / pause (K / Space)" className={buttonClass} onClick={() => sendPlayerCommand("toggle-play")}>{playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}</button>
        <button type="button" disabled={!ready} aria-label="Forward 5 seconds" title="Forward 5 seconds (L / →)" className={buttonClass} onClick={() => useWorkspaceStore.getState().requestSeekTo(useWorkspaceStore.getState().currentTime + 5)}><RotateCw className="h-4 w-4" /></button>
        <button type="button" disabled={!ready} aria-label={muted ? "Unmute video" : "Mute video"} title="Mute / unmute (M)" className={buttonClass} onClick={() => sendPlayerCommand("toggle-mute")}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
        <button type="button" disabled={!ready} aria-label="Decrease playback speed" title="Slower (Shift + <)" className={buttonClass} onClick={() => sendPlayerCommand("speed-down")}><Minus className="h-3.5 w-3.5" /></button>
        <span className="min-w-9 text-center text-xs font-semibold tabular-nums" aria-label="Current playback speed">{rate}×</span>
        <button type="button" disabled={!ready} aria-label="Increase playback speed" title="Faster (Shift + >)" className={buttonClass} onClick={() => sendPlayerCommand("speed-up")}><Plus className="h-3.5 w-3.5" /></button>
      </div>
    </div>
    <div className="flex flex-wrap justify-between gap-2 px-2 pb-1 text-[10px] text-slate-500"><span className="tabular-nums">{timeLabel}</span><span>Shortcuts: K · J / L · M · ?</span></div>
    {failed && <a className="block px-3 pb-3 text-sm text-blue-600 underline" href={"https://www.youtube.com/watch?v=" + encodeURIComponent(videoId)} target="_blank" rel="noopener noreferrer">Open on YouTube</a>}
  </section>);
};

export const YouTubeSyncPlayer: React.FC<YouTubeSyncPlayerProps> = props => <Player key={props.videoId} {...props} />;
