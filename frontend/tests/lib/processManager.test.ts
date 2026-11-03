import { beforeEach, expect, it } from "vitest";
import { cancelProcess, runProcess, startProcess, useProcessStore } from "@/lib/processManager";
import { useLoadingStore } from "@/lib/loadingStore";
beforeEach(() => useProcessStore.setState({ processes: [] }));
it("finishes only its own process and ignores late progress", () => {
  const first = startProcess("first");
  const second = startProcess("second");
  first.finish("failed"); first.stage("Late");
  expect(useProcessStore.getState().processes[0]).toMatchObject({ status: "failed", stage: "Starting" });
  expect(useProcessStore.getState().processes[1]?.status).toBe("running");
  second.finish();
});
it("does not let one loading operation hide another", () => {
  const first = useLoadingStore.getState().startLoading({ title: "Extracting" });
  const second = useLoadingStore.getState().startLoading({ title: "Restoring" });
  useLoadingStore.getState().stopLoading(first);
  expect(useLoadingStore.getState()).toMatchObject({ isLoading: true, title: "Restoring" });
  useLoadingStore.getState().stopLoading(first);
  expect(useLoadingStore.getState().isLoading).toBe(true);
  useLoadingStore.getState().stopLoading(second);
  expect(useLoadingStore.getState().isLoading).toBe(false);
});
it("records cancellation without storing exception details", async () => {
  const controller = new AbortController(); controller.abort();
  await expect(runProcess("export", async () => "unused", controller.signal)).rejects.toBeDefined();
  expect(useProcessStore.getState().processes[0]).toMatchObject({ status: "cancelled" });
  expect(Object.keys(useProcessStore.getState().processes[0]!)).not.toContain("error");
});
it("bounds completed history and records elapsed time", async () => {
  for (let i = 0; i < 100; i++) await runProcess("request", async () => i);
  expect(useProcessStore.getState().processes).toHaveLength(40);
  expect(useProcessStore.getState().processes.every(item => item.elapsedMs !== undefined && item.elapsedMs >= 0)).toBe(true);
});

it("cancels managed work through its owned signal", async () => {
  const pending = runProcess("request", process => new Promise<void>((_resolve, reject) => {
    process.signal.addEventListener("abort", () => reject(process.signal.reason), { once: true });
  }));
  const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  cancelProcess(useProcessStore.getState().processes[0]!.id);
  await assertion;
  expect(useProcessStore.getState().processes[0]?.status).toBe("cancelled");
});
