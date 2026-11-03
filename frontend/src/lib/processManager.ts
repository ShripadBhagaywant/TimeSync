import { create } from "zustand";

export type ProcessStatus = "running" | "completed" | "failed" | "cancelled";
export interface ManagedProcess {
  id: number;
  kind: string;
  stage: string;
  status: ProcessStatus;
  startedAt: number;
  elapsedMs?: number;
}
let sequence = 0;
const controllers = new Map<number, AbortController>();
export const cancelProcess = (id: number) => controllers.get(id)?.abort();
export const useProcessStore = create<{ processes: ManagedProcess[] }>(() => ({ processes: [] }));

/** In-memory lifecycle metadata only: never store transcripts, URLs or provider errors. */
export function startProcess(kind: string) {
  const id = ++sequence;
  const startedAt = performance.now();
  const controller = new AbortController();
  controllers.set(id, controller);
  useProcessStore.setState(state => ({ processes: [
    ...state.processes.filter(process => process.status === "running"),
    ...state.processes.filter(process => process.status !== "running").slice(-39),
    { id, kind, stage: "Starting", status: "running", startedAt },
  ] }));
  const update = (patch: Partial<ManagedProcess>) => useProcessStore.setState(state => ({
    processes: state.processes.map(process => process.id === id && process.status === "running" ? { ...process, ...patch } : process),
  }));
  return {
    id,
    signal: controller.signal,
    stage: (stage: string) => update({ stage }),
    finish: (status: Exclude<ProcessStatus, "running"> = "completed") => {
      controllers.delete(id);
      update({ status, elapsedMs: Math.max(0, performance.now() - startedAt) });
    },
  };
}

export async function runProcess<T>(kind: string, work: (process: ReturnType<typeof startProcess>) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const process = startProcess(kind);
  const abort = () => cancelProcess(process.id);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  try {
    process.signal.throwIfAborted();
    const result = await work(process);
    process.signal.throwIfAborted();
    process.finish();
    return result;
  } catch (error) {
    process.finish(process.signal.aborted ? "cancelled" : "failed");
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
