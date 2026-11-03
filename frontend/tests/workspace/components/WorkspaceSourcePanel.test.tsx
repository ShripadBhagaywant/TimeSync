// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceSourcePanel } from "@/features/workspace/components/WorkspaceSourcePanel";
vi.mock("@/features/workspace/components/player/YouTubeSyncPlayer", () => ({ YouTubeSyncPlayer: () => <div>Player</div> }));
vi.mock("@/features/workspace/components/info/VideoInfoPanel", () => ({ VideoInfoPanel: () => <div>Information</div> }));
vi.mock("@/features/workspace/components/chapters/ChaptersDrawer", () => ({ ChaptersDrawer: () => <div>Chapters</div> }));
vi.mock("@/features/workspace/components/transcript/InteractiveTranscript", () => ({ InteractiveTranscript: () => <input aria-label="Transcript search" defaultValue="" /> }));
afterEach(cleanup);
it("preserves transcript input through tab changes and resets it for a different video", () => {
  const props = { videoId: "one", setLeftTab: vi.fn(), onImportTranscript: vi.fn() };
  const { rerender } = render(<WorkspaceSourcePanel {...props} leftTab="transcript" />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Docker" } });
  rerender(<WorkspaceSourcePanel {...props} leftTab="info" />);
  expect(screen.queryByRole("textbox")).toBeNull();
  rerender(<WorkspaceSourcePanel {...props} leftTab="transcript" />);
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Docker");
  rerender(<WorkspaceSourcePanel {...props} videoId="two" leftTab="transcript" />);
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
});
