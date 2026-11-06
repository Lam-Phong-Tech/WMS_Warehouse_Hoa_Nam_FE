import type {
  PackingLabelDimension,
  PackingLabelEvent,
} from "./packing-label-api";
import { tStatic, type TranslateFn } from "@/shared/i18n/useT";

export function labelRows(
  labels: Map<string, PackingLabelDimension>,
  events: PackingLabelEvent[],
) {
  return [...labels].map(([labelId, label]) => {
    const attempts = events
      .filter((event) => event.labelId === labelId)
      .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt));
    return {
      labelId,
      label,
      latest: attempts[0] ?? null,
      total: label.totalAttempts ?? attempts.length,
      printed: attempts.filter((e) => e.result === "PRINTED").length,
      failed: attempts.filter((e) => e.result === "PRINT_FAILED").length,
      reprinted: attempts.filter((e) => e.action === "REPRINT").length,
    };
  });
}

export function printMetrics(
  labels: Map<string, PackingLabelDimension>,
  events: PackingLabelEvent[],
) {
  return {
    labels: labels.size,
    total: events.length,
    printed: events.filter((e) => e.result === "PRINTED").length,
    failed: events.filter((e) => e.result === "PRINT_FAILED").length,
    pending: events.filter((e) => e.result === "PENDING_PRINT").length,
    reprinted: events.filter((e) => e.action === "REPRINT").length,
  };
}

export function printGate(
  status: string,
  attempts: PackingLabelEvent[],
  missing: string[] = [],
  t: TranslateFn = tStatic,
): { action: "PRINT" | "REPRINT" | null; reason: string } {
  if (missing.length)
    return {
      action: null,
      reason: t("packingLabelReport.missingSnapshot", {
        fields: missing.join(", "),
      }),
    };
  if (attempts.some((e) => e.result === "PENDING_PRINT"))
    return {
      action: null,
      reason: t("packingLabelReport.pendingGate"),
    };
  if (status === "PRINTED") return { action: "REPRINT", reason: "" };
  if (status === "READY_TO_PRINT" || status === "PRINT_FAILED")
    return { action: "PRINT", reason: "" };
  return {
    action: null,
    reason: t("packingLabelReport.notReadyGate"),
  };
}

/** Required values must come from the immutable payload, never from live source data. */
export function snapshotPayload(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return snapshotPayload(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function snapshotItems(
  payload: Record<string, unknown>,
): Record<string, unknown>[] {
  const source =
    Array.isArray(payload.items) && payload.items.length
      ? payload.items
      : payload.sku_summary;
  return Array.isArray(source)
    ? source.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

export function snapshotMissing(
  payload: Record<string, unknown>,
  t: TranslateFn = tStatic,
) {
  const missing: string[] = [];
  if (!String(payload.recipient_name ?? payload.customer_name ?? "").trim())
    missing.push(t("packingLabelReport.missingRecipient"));
  if (!String(payload.outbound_no ?? "").trim())
    missing.push(t("packingLabelReport.missingOutbound"));
  const items = snapshotItems(payload);
  if (
    !items.length ||
    items.some(
      (item) =>
        !String(item.sku_code ?? "").trim() || !(Number(item.quantity) > 0),
    )
  )
    missing.push(t("packingLabelReport.missingSkuQuantity"));
  return missing;
}
