// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ get: vi.fn(), getAll: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("idb", () => ({ openDB: vi.fn(async () => db) }));
import { deleteDraft, getDraft, getAllDrafts, saveDraft, writeDraftRecoverySnapshot, EDITOR_DRAFT_TTL_MS } from "@/lib/indexDB";
const draft = { videoId: "one", videoTitle: "Lesson", content: "<p>Notes</p>", updatedAt: 123 };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); db.get.mockResolvedValue(undefined); db.getAll.mockResolvedValue([]); });
describe("draft storage boundary", () => {
  it("preserves the existing draft store, key, content and timestamp", async () => {
    await saveDraft(draft);
    expect(db.put).toHaveBeenCalledWith("drafts", draft);
    await getDraft("one");
    expect(db.get).toHaveBeenCalledWith("drafts", "one");
    await deleteDraft("one");
    expect(db.delete).toHaveBeenCalledWith("drafts", "one");
    await getAllDrafts();
    expect(db.getAll).toHaveBeenCalledWith("drafts");
  });
  it("checks the autosave generation after awaiting database initialization", async () => {
    let current = true;
    const pending = saveDraft(draft, () => current);
    current = false;
    await pending;
    expect(db.put).not.toHaveBeenCalled();
  });
  it("recovers a newer synchronous close snapshot when IndexedDB has an older copy", async () => {
    const oldDraft = { ...draft, content: "old", updatedAt: 100 };
    const lastEdit = { ...draft, content: "latest edit", updatedAt: 200 };
    db.get.mockResolvedValue(oldDraft);
    expect(writeDraftRecoverySnapshot(lastEdit)).toBe(true);
    await expect(getDraft("one")).resolves.toEqual(lastEdit);
  });
  it("uses the recovery snapshot if IndexedDB cannot be read", async () => {
    db.get.mockRejectedValue(new Error("IndexedDB unavailable"));
    writeDraftRecoverySnapshot(draft);
    await expect(getDraft("one")).resolves.toEqual(draft);
  });
  it("uses a seven-day editor-draft lifetime and removes recovery data on delete", async () => {
    expect(EDITOR_DRAFT_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    writeDraftRecoverySnapshot(draft);
    await deleteDraft("one");
    expect(localStorage.getItem("timesync-editor-draft:one")).toBeNull();
  });
});
