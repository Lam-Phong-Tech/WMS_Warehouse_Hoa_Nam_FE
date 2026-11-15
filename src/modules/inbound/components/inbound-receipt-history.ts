import { EMPTY_TEXT } from "@/shared/constants/display";
import { parseDateTime } from "@/shared/utils/date-time";
import type {
  InboundDetail,
  InboundOperationEvent,
  InboundScanEntry,
} from "../types";

export const inboundTime = (value?: string) =>
  value ? parseDateTime(value).format("DD/MM/YYYY HH:mm") : EMPTY_TEXT;

export function inboundHistory(
  detail: InboundDetail,
  entries: InboundScanEntry[],
): InboundOperationEvent[] {
  if (detail.operationHistory !== undefined) return detail.operationHistory;
  // Compatibility with older servers: use only saved event times, never updatedAt.
  const events: InboundOperationEvent[] = (detail.statusHistory ?? []).map(
    (event) => ({
      id: event.id,
      action:
        event.toStatus === "POSTED"
          ? "POST"
          : event.toStatus === "CANCELLED"
            ? "CANCEL"
            : event.toStatus === "DRAFT"
              ? "CREATE"
              : "SCAN_START",
      occurredAt: event.changedAt || undefined,
      actorName:
        event.changedBy ||
        (event.toStatus === "POSTED"
          ? detail.document.postedBy
          : event.toStatus === "CANCELLED"
            ? detail.document.cancelledBy
            : event.toStatus === "DRAFT"
              ? detail.document.createdBy
              : "") ||
        "",
      note: event.note,
    }),
  );
  if (
    !events.some((event) => event.action === "CREATE") &&
    detail.document.createdAt
  )
    events.push({
      id: "created",
      action: "CREATE",
      occurredAt: detail.document.createdAt,
      actorName: detail.document.createdBy,
      note: "",
    });
  entries.forEach((entry) => {
    if (entry.capturedAt)
      events.push({
        id: `scan-${entry.id}`,
        action: "SCAN",
        occurredAt: entry.capturedAt,
        actorName: "",
        note: [
          entry.itemCode || entry.candidateItemUnique || entry.containerCode,
          entry.sku,
        ]
          .filter(Boolean)
          .join(" · "),
      });
  });
  return events.sort(
    (a, b) =>
      (a.occurredAt ? Date.parse(a.occurredAt) : 0) -
      (b.occurredAt ? Date.parse(b.occurredAt) : 0),
  );
}
