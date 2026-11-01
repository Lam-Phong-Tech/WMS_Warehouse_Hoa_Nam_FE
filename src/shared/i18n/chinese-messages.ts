import { create } from "zustand";
import type { MessageTree } from "./messages";

type Status = "idle" | "loading" | "ready" | "error";
const useChineseMessagesStore = create<{
  messages: MessageTree | null;
  status: Status;
}>(() => ({
  messages: null,
  status: "idle",
}));
let loading: Promise<void> | null = null;
let businessLabels: Record<string, string> | null = null;

/** Load Simplified Chinese only when the user selects it. */
export function ensureChineseMessages(): Promise<void> {
  if (useChineseMessagesStore.getState().messages) return Promise.resolve();
  if (loading) return loading;
  loading = Promise.all([
    import("./messages.zh"),
    import("./business-labels.zh"),
  ])
    .then(([{ MESSAGES_ZH }, { BUSINESS_LABELS_ZH }]) => {
      businessLabels = BUSINESS_LABELS_ZH;
      useChineseMessagesStore.setState({
        messages: MESSAGES_ZH,
        status: "ready",
      });
    })
    .catch(() => {
      useChineseMessagesStore.setState({ status: "error" });
    })
    .finally(() => {
      loading = null;
    });
  useChineseMessagesStore.setState({ status: "loading" });
  return loading;
}

export const chineseMessages = () =>
  useChineseMessagesStore.getState().messages;
export const chineseBusinessLabel = (english: string) =>
  businessLabels?.[english] ?? english;
export const useChineseMessages = () =>
  useChineseMessagesStore((state) => state.messages);
export const useChineseMessagesStatus = () =>
  useChineseMessagesStore((state) => state.status);
