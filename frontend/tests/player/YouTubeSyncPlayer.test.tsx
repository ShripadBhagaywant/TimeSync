// @vitest-environment jsdom
import { act, cleanup, render, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YouTubeSyncPlayer } from "@/features/workspace/components/player/YouTubeSyncPlayer";
import { useWorkspaceShortcuts } from "@/features/workspace/hooks/useWorkspaceShortcuts";
import { sendPlayerCommand } from "@/features/workspace/utils/playerCommands";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";
type PlayerOptions = ConstructorParameters<NonNullable<Window["YT"]>["Player"]>[1];
const instances: MockPlayer[] = [];
class MockPlayer {
  destroy = vi.fn();
  getCurrentTime = vi.fn(() => 24);
  seekTo = vi.fn();
  playVideo = vi.fn();
  pauseVideo = vi.fn();
  getPlayerState = vi.fn(() => 2);
  isMuted = vi.fn(() => false);
  mute = vi.fn();
  unMute = vi.fn();
  getPlaybackRate = vi.fn(() => 1);
  getAvailablePlaybackRates = vi.fn(() => [0.5, 1, 1.5, 2]);
  setPlaybackRate = vi.fn();
  constructor(_element: string, public options: PlayerOptions) { instances.push(this); }
}
beforeEach(() => {
  vi.useFakeTimers();
  instances.length = 0;
  useWorkspaceStore.getState().resetWorkspace();
  window.YT = { Player: MockPlayer, PlayerState: { PLAYING: 1 } };
});
afterEach(() => { cleanup(); delete window.YT; vi.useRealTimers(); });
describe("YouTube player lifecycle without live YouTube", () => {
  it("tracks playback and cleans up its timer and player on unmount", () => {
    const { unmount } = render(<YouTubeSyncPlayer videoId="one" />);
    const player = instances[0]!;
    act(() => { player.options.events.onReady(); player.options.events.onStateChange({ data: 1 }); vi.advanceTimersByTime(500); });
    expect(useWorkspaceStore.getState().currentTime).toBe(24);
    unmount();
    expect(player.destroy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("seeks the mounted player and replaces it when the video changes", () => {
    const { rerender } = render(<YouTubeSyncPlayer videoId="one" />);
    const first = instances[0]!;
    act(() => { useWorkspaceStore.getState().requestSeekTo(42); });
    expect(first.seekTo).not.toHaveBeenCalled();
    act(() => first.options.events.onReady());
    expect(first.seekTo).toHaveBeenCalledWith(42, true);
    expect(first.playVideo).toHaveBeenCalledOnce();
    expect(useWorkspaceStore.getState().seekRequestedTime).toBeNull();
    rerender(<YouTubeSyncPlayer videoId="two" />);
    expect(first.destroy).toHaveBeenCalledOnce();
    expect(instances[1]?.options.videoId).toBe("two");
  });
});

it("connects playback, mute, and supported speed commands to the ready player", () => {
  render(<YouTubeSyncPlayer videoId="one" />);
  const player = instances[0]!;
  act(() => sendPlayerCommand("toggle-play"));
  expect(player.playVideo).not.toHaveBeenCalled();
  act(() => player.options.events.onReady());
  act(() => sendPlayerCommand("toggle-play"));
  expect(player.playVideo).toHaveBeenCalledOnce();
  player.getPlayerState.mockReturnValue(1);
  act(() => sendPlayerCommand("toggle-play"));
  expect(player.pauseVideo).toHaveBeenCalledOnce();
  act(() => sendPlayerCommand("toggle-mute"));
  expect(player.mute).toHaveBeenCalledOnce();
  player.isMuted.mockReturnValue(true);
  act(() => sendPlayerCommand("toggle-mute"));
  expect(player.unMute).toHaveBeenCalledOnce();
  act(() => sendPlayerCommand("speed-up"));
  expect(player.setPlaybackRate).toHaveBeenLastCalledWith(1.5);
  act(() => sendPlayerCommand("speed-down"));
  expect(player.setPlaybackRate).toHaveBeenLastCalledWith(0.5);
  player.getPlaybackRate.mockReturnValue(2);
  player.setPlaybackRate.mockClear();
  act(() => sendPlayerCommand("speed-up"));
  expect(player.setPlaybackRate).not.toHaveBeenCalled();
});
it("removes the command listener when the player is unmounted", () => {
  const { unmount } = render(<YouTubeSyncPlayer videoId="one" />);
  const player = instances[0]!;
  act(() => player.options.events.onReady());
  unmount();
  sendPlayerCommand("toggle-play");
  expect(player.playVideo).not.toHaveBeenCalled();
});

it("routes actual workspace keys to player controls without custom callbacks", () => {
  function Workspace() { useWorkspaceShortcuts(); return <YouTubeSyncPlayer videoId="one" />; }
  render(<Workspace />);
  const player = instances[0]!;
  act(() => player.options.events.onReady());
  fireEvent.keyDown(window, { code: "KeyK", key: "k" });
  expect(player.playVideo).toHaveBeenCalledOnce();
  fireEvent.keyDown(window, { code: "KeyM", key: "m" });
  expect(player.mute).toHaveBeenCalledOnce();
  fireEvent.keyDown(window, { code: "Period", key: ">", shiftKey: true });
  expect(player.setPlaybackRate).toHaveBeenLastCalledWith(1.5);
  fireEvent.keyDown(window, { code: "Comma", key: "<", shiftKey: true });
  expect(player.setPlaybackRate).toHaveBeenLastCalledWith(0.5);
  fireEvent.keyDown(window, { code: "KeyK", key: "k", repeat: true });
  expect(player.playVideo).toHaveBeenCalledOnce();
});

it("keeps visible player controls in sync with keyboard commands", () => {
  render(<YouTubeSyncPlayer videoId="one" />);
  const player = instances[0]!;
  expect((screen.getByRole("button", { name: "Play video" }) as HTMLButtonElement).disabled).toBe(true);
  act(() => player.options.events.onReady());
  fireEvent.click(screen.getByRole("button", { name: "Play video" }));
  expect(player.playVideo).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Pause video" })).toBeTruthy();
  act(() => sendPlayerCommand("toggle-mute"));
  expect(screen.getByRole("button", { name: "Unmute video" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Increase playback speed" }));
  expect(screen.getByLabelText("Current playback speed").textContent).toBe("1.5×");
});

it("keeps shortcuts working when an external player control has focus", () => {
  function Workspace() { useWorkspaceShortcuts(); return <YouTubeSyncPlayer videoId="one" />; }
  render(<Workspace />);
  const player=instances[0]!;
  act(() => player.options.events.onReady());
  const button=screen.getByRole("button", {name:"Play video"});
  button.focus();
  fireEvent.keyDown(button,{code:"KeyM",key:"m"});
  expect(player.mute).toHaveBeenCalledOnce();
  fireEvent.keyDown(button,{code:"Space",key:" "});
  expect(player.playVideo).not.toHaveBeenCalled();
});
