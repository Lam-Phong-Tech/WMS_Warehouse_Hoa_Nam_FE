import { useCallback, useEffect, useRef, useState } from "react";
import {
  solvePowChallenge,
  type PowWorkerRequest,
  type PowWorkerResponse,
} from "@/modules/auth/utils/login-pow.worker";

export type LoginPowOutcome =
  | { kind: "solved"; solution: number }
  | { kind: "unsupported" }
  | { kind: "cancelled" }
  | { kind: "timeout" };

const DEFAULT_TIMEOUT_MS = 10_000;

class InlinePowWorker {
  onmessage: ((event: MessageEvent<PowWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private timer: number | null = null;

  postMessage(data: PowWorkerRequest) {
    this.timer = window.setTimeout(() => {
      try {
        const solution = solvePowChallenge(data.nonce, data.difficulty);
        this.onmessage?.({
          data: { solution },
        } as MessageEvent<PowWorkerResponse>);
      } catch (err) {
        this.onerror?.(err as ErrorEvent);
      }
    }, 450);
  }

  terminate() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

if (typeof globalThis.Worker === "undefined") {
  globalThis.Worker = InlinePowWorker as unknown as typeof Worker;
  if (typeof window !== "undefined") {
    window.Worker = InlinePowWorker as unknown as typeof Worker;
  }
}

export function useLoginPow(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const [solving, setSolving] = useState(false);
  const workerRef = useRef<{ terminate: () => void } | null>(null);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((outcome: LoginPowOutcome) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    cleanup();
    setSolving(false);
    if (resolveRef.current) {
      const finish = resolveRef.current;
      resolveRef.current = null;
      finish({ kind: "cancelled" });
    }
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  const solve = useCallback(
    (nonce: string, difficulty: number): Promise<LoginPowOutcome> => {
      const WorkerCtor =
        typeof Worker === "function" ? Worker : undefined;
      if (!WorkerCtor) {
        return Promise.resolve({ kind: "unsupported" });
      }

      cleanup();
      setSolving(true);

      return new Promise<LoginPowOutcome>((resolve) => {
        resolveRef.current = resolve;

        const finish = (outcome: LoginPowOutcome) => {
          if (resolveRef.current !== resolve) return;
          resolveRef.current = null;
          cleanup();
          setSolving(false);
          resolve(outcome);
        };

        timerRef.current = window.setTimeout(() => {
          finish({ kind: "timeout" });
        }, timeoutMs);

        const startFallbackWorker = () => {
          const fallback = new InlinePowWorker();
          workerRef.current = fallback;
          fallback.onmessage = (event: MessageEvent<PowWorkerResponse>) => {
            if (typeof event.data?.solution === "number") {
              finish({ kind: "solved", solution: event.data.solution });
            } else {
              finish({ kind: "unsupported" });
            }
          };
          fallback.onerror = () => {
            finish({ kind: "unsupported" });
          };
          fallback.postMessage({ nonce, difficulty });
        };

        if (
          (WorkerCtor as unknown) === InlinePowWorker ||
          import.meta.env.MODE === "test"
        ) {
          startFallbackWorker();
          return;
        }

        try {
          const workerUrl = new URL(
            "../utils/login-pow.worker.ts",
            import.meta.url,
          );
          const worker = new WorkerCtor(workerUrl, { type: "module" });
          workerRef.current = worker;
          worker.onmessage = (event: MessageEvent<PowWorkerResponse>) => {
            if (typeof event.data?.solution === "number") {
              finish({ kind: "solved", solution: event.data.solution });
            } else {
              finish({ kind: "unsupported" });
            }
          };
          worker.onerror = () => {
            startFallbackWorker();
          };
          worker.postMessage({ nonce, difficulty });
        } catch {
          startFallbackWorker();
        }
      });
    },
    [cleanup, timeoutMs],
  );

  return { solving, solve, cancel };
}
