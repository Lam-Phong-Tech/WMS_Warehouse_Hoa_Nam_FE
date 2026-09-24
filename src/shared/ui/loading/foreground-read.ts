import type { LoadingController } from "./loading-controller";

type ReadGate = Pick<LoadingController, "beginBatch" | "setParticipant">;

/** Foreground READS only. Never use this for save, export or other mutations. */
export function createForegroundReadTask(controller: ReadGate | null, id: string) {
  let sequence = 0;
  let active = true;
  const pending = new Set<string>();

  return {
    async run<T>(read: () => T | PromiseLike<T>): Promise<Awaited<T>> {
      // A later read must not share a ticket with an unfinished older read.
      const ticket = `${id}:${++sequence}`;
      pending.add(ticket);
      if (active) {
        controller?.setParticipant(ticket, true);
        controller?.beginBatch();
      }
      try {
        return await read();
      } finally {
        // Resolve, reject and synchronous throw all settle this read's ticket.
        pending.delete(ticket);
        if (active) controller?.setParticipant(ticket, false);
      }
    },
    activate() {
      if (active) return;
      active = true;
      for (const ticket of pending) controller?.setParticipant(ticket, true);
      if (pending.size > 0) controller?.beginBatch();
    },
    deactivate() {
      active = false;
      // Navigation/closing never cancels or re-sends backend work. Retain the
      // promises so an Activity/keep-alive resume can rejoin unfinished reads.
      for (const ticket of pending) controller?.setParticipant(ticket, false);
    },
  };
}
