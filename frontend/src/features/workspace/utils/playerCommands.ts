export const PLAYER_COMMAND_EVENT = "timesync:player-command";
export type PlayerCommand = "toggle-play" | "toggle-mute" | "speed-up" | "speed-down";
export const sendPlayerCommand = (command: PlayerCommand) =>
  window.dispatchEvent(new CustomEvent<PlayerCommand>(PLAYER_COMMAND_EVENT, { detail: command }));
