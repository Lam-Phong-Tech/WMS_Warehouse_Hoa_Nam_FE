import type { LoadingController } from "./loading-controller";

type Owner = { current: object | null };

/** A lifecycle acknowledgement belongs to one committed chart revision only. */
export function createChartRenderCycle(
  controller: Pick<LoadingController, "setParticipant"> | null,
  id: string,
  owner: Owner,
) {
  const key = {};
  return {
    activate(pending = true) {
      owner.current = key;
      controller?.setParticipant(id, pending);
    },
    complete() {
      if (owner.current === key) controller?.setParticipant(id, false);
    },
    dispose() {
      if (owner.current !== key) return;
      owner.current = null;
      controller?.setParticipant(id, false);
    },
  };
}
