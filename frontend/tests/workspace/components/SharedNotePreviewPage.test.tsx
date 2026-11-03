// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SharedNotePreviewPage } from "@/features/notes/pages/SharedNotePreviewPage";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  notifyInfo: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: mocks.useQuery }));
vi.mock("@/lib/toast", () => ({ notify: { info: mocks.notifyInfo } }));

const Location = () => <span>{useLocation().pathname}</span>;
const renderPreview = () => render(
  <MemoryRouter initialEntries={["/notes/shared/test-hash"]}>
    <Routes>
      <Route path="/notes/shared/:hashId" element={<SharedNotePreviewPage />} />
      <Route path="/" element={<Location />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useQuery.mockReturnValue({
    data: {
      hashId: "test-hash",
      videoId: "abc123",
      videoTitle: "Shared lesson",
      noteContent: "<p>Read-only notes</p>",
      createdAt: "2026-01-01T00:00:00Z",
      expiresAt: "2026-01-02T00:00:00Z",
    },
    isLoading: false,
    error: null,
  });
});
afterEach(cleanup);

it("shows a compact shared-note header and notifies before returning home", () => {
  renderPreview();
  expect(screen.getByRole("heading", { name: "Shared lesson" })).toBeInTheDocument();
  expect(screen.getByText("Read-only snapshot")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to Home" }));
  expect(mocks.notifyInfo).toHaveBeenCalledWith("Returning home", "This shared note is read-only.");
  expect(screen.getByText("/")).toBeInTheDocument();
});

it("also notifies when the shared link is unavailable", () => {
  mocks.useQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error("missing") });
  renderPreview();
  fireEvent.click(screen.getByRole("button", { name: "Back home" }));
  expect(mocks.notifyInfo).toHaveBeenCalledWith("Returning home", "This shared note is read-only.");
  expect(screen.getByText("/")).toBeInTheDocument();
});
