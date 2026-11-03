import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ get: vi.fn(), getAll: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("idb", () => ({ openDB: vi.fn(async () => db) }));
import { deleteDraft, getDraft, getAllDrafts, saveDraft } from "@/lib/indexDB";
const draft = { videoId: "one", videoTitle: "Lesson", content: "<p>Notes</p>", updatedAt: 123 };
beforeEach(() => vi.clearAllMocks());
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
});
