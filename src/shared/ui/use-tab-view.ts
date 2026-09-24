import { useCallback, useRef, useState, useTransition } from "react";
import { useLoadingParticipant } from "./loading/loading-context";

/** The selected tab responds immediately; its panel commits in a transition. */
export interface TabView<T> {
  readonly view: T;
  readonly shown: T;
  readonly select: (next: T) => void;
  readonly isPending: boolean;
}

export function useTabView<T>(initial: T): TabView<T> {
  const [committed, setCommitted] = useState<T>(initial);
  const [pending, setPending] = useState<T | null>(null);
  const [isPending, startTransition] = useTransition();
  const selected = useRef(initial);
  // Query completion is not panel completion. Keep the read gate closed until
  // React commits the selected panel; newly mounted chart tickets then take over.
  useLoadingParticipant(isPending);

  const select = useCallback((next: T) => {
    if (Object.is(next, selected.current)) return;
    selected.current = next;
    setPending(next);
    startTransition(() => {
      setCommitted(next);
      setPending(null);
    });
  }, []);

  return {
    view: committed,
    shown: pending ?? committed,
    select,
    isPending,
  };
}
