import { create } from "zustand";
import { startProcess } from "./processManager";
interface LoadingOptions { title?: string; message?: string; showBackdrop?: boolean; }
interface LoadingState {
  isLoading: boolean; title: string; message: string; showBackdrop: boolean;
  startLoading: (options?: LoadingOptions) => number;
  stopLoading: (id?: number) => void;
}
const defaults = { isLoading: false, title: "Loading", message: "Please wait while your workspace prepares.", showBackdrop: true };
const active = new Map<number, { options: LoadingOptions; process: ReturnType<typeof startProcess> }>();
export const useLoadingStore = create<LoadingState>((set) => {
  const publish = () => {
    const latest = [...active.values()].at(-1);
    set(latest ? { ...defaults, ...latest.options, isLoading: true } : defaults);
  };
  return {
    ...defaults,
    startLoading: (options = {}) => {
      const process = startProcess("workspace-loading");
      process.stage(options.title ?? "Loading");
      active.set(process.id, { options, process });
      publish();
      return process.id;
    },
    stopLoading: (id) => {
      const ownedId = id ?? [...active.keys()].at(-1);
      if (ownedId === undefined) return;
      active.get(ownedId)?.process.finish();
      active.delete(ownedId);
      publish();
    },
  };
});
