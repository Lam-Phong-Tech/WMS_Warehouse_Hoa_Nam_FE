import { create } from "zustand";
import type { MessageTree } from "./messages";

export type EnglishMessagesStatus = "idle" | "loading" | "ready" | "error";

interface EnglishMessagesState {
  messages: MessageTree | null;
  status: EnglishMessagesStatus;
}

/** Keep English out of the initial Vietnamese bundle. */
const useEnglishMessagesStore = create<EnglishMessagesState>(() => ({
  messages: null,
  status: "idle",
}));

let loading: Promise<void> | null = null;
let generation = 0;

/**
 * Share one in-flight request. A failed download is retryable, not a silent
 * switch back to Vietnamese. EnglishLanguageBoundary handles the loading/error
 * UI; translate() retains its safe fallback for non-React callers and tests.
 */
export function ensureEnglishMessages(): Promise<void> {
  if (useEnglishMessagesStore.getState().messages) return Promise.resolve();
  if (loading) return loading;

  const requestGeneration = generation;
  loading = import("./messages.en")
    .then((module) => {
      if (requestGeneration !== generation) return;
      useEnglishMessagesStore.setState({
        messages: module.MESSAGES_EN,
        status: "ready",
      });
    })
    .catch(() => {
      if (requestGeneration !== generation) return;
      useEnglishMessagesStore.setState({ status: "error" });
    })
    .finally(() => {
      if (requestGeneration === generation) loading = null;
    });
  useEnglishMessagesStore.setState({ status: "loading" });
  return loading;
}

export function englishMessages(): MessageTree | null {
  return useEnglishMessagesStore.getState().messages;
}

export function useEnglishMessages(): MessageTree | null {
  return useEnglishMessagesStore((state) => state.messages);
}

export function useEnglishMessagesStatus(): EnglishMessagesStatus {
  return useEnglishMessagesStore((state) => state.status);
}

/** Test isolation also invalidates a download started by a previous test. */
export function __resetEnglishMessages(): void {
  generation += 1;
  loading = null;
  useEnglishMessagesStore.setState({ messages: null, status: "idle" });
}
