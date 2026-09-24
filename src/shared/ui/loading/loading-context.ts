import { createContext, useContext, useId, useLayoutEffect } from "react";
import type { LoadingController } from "./loading-controller";
export const LoadingDepthContext = createContext(0);
export const LoadingContext = createContext<LoadingController | null>(null);
/** Register non-query preparation without unmounting the work it depends on. */
export function useLoadingParticipant(pending: boolean): void {
  const controller = useContext(LoadingContext);
  const id = useId();
  useLayoutEffect(() => {
    if (!controller || !pending) return;
    controller.setParticipant(id, true);
    return () => controller.setParticipant(id, false);
  }, [controller, id, pending]);
}
const noop = () => {};
/** Call immediately before a foreground filter / refresh, never a write. */
export function useBeginLoadingBatch(): () => void {
  return useContext(LoadingContext)?.beginBatch ?? noop;
}
