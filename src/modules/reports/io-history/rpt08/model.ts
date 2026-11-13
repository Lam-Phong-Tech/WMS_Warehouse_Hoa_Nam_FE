import { parseDateTime, BUSINESS_TIMEZONE } from "@/shared/utils/date-time";
import dayjs from "dayjs";
import type { IoDocType, IoHistoryRow } from "../io-history-api";
import { ISO_DATE } from "../io-history-api";
import { tStatic as tUi } from "@/shared/i18n/useT";

export type TransactionFilter = "ALL" | "INBOUND" | "OUTBOUND" | "REVERSAL";
export type ExportState = "idle" | "exporting" | "failed" | "unknown";

export type AppliedFilters = {
  from: string;
  to: string;
  type: TransactionFilter;
  actor: string;
};

export type HistoryRow = {
  id: string;
  timestamp: string;
  documentNo: string;
  type: IoDocType;
  objectPrimary: string;
  objectSecondary: string;
  quantity: number | null;
  actor: string;
  source?: IoHistoryRow;
};

export type DailyMovement = {
  key: string;
  label: string;
  inbound: number;
  outbound: number;
  reversal: number;
};

export const PAGE_SIZE = 5;
export const VI_TIMEZONE_LABEL = "Múi giờ Việt Nam";

export function number(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(value)));
}

export function percent(value: number): string {
  return value.toFixed(1).replace(".", ",") + "%";
}

export function displayStamp(value: string): string {
  const parsed = parseDateTime(value);
  if (!parsed.isValid()) return "—";
  return parsed.format("DD/MM/YYYY · HH:mm");
}

export function displayDay(value: string): string {
  const parsed = parseDateTime(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "—";
}

export function displayAsOf(value: string): string {
  const parsed = parseDateTime(value);
  return parsed.isValid()
    ? parsed.format("DD/MM/YYYY · HH:mm")
    : tUi("updatedUi.text_b495069027b3");
}

function parseObject(row: IoHistoryRow): [string, string] {
  if (row.type === "REVERSAL") {
    return [row.party || row.documentNo || "—", row.originalDocumentNo || "—"];
  }
  const firstSku =
    row.skuLines.find((line) => line.trim() !== "")?.trim() ?? "";
  if (firstSku) {
    const separators = [" · ", " - ", " | "];
    for (const separator of separators) {
      const index = firstSku.indexOf(separator);
      if (index > 0) {
        return [
          firstSku.slice(0, index).trim(),
          firstSku.slice(index + separator.length).trim(),
        ];
      }
    }
    return [firstSku, row.party || "—"];
  }
  return [row.party || row.documentNo || "—", "—"];
}

export function mapLiveRow(row: IoHistoryRow): HistoryRow | null {
  const [objectPrimary, objectSecondary] = parseObject(row);
  return {
    id: row.id || row.documentNo,
    timestamp: row.postedAt || row.createdAt,
    documentNo: row.documentNo || "—",
    type: row.type,
    objectPrimary,
    objectSecondary,
    quantity: row.qty === null ? null : Math.abs(row.qty),
    actor: row.actor || "—",
    source: row,
  };
}

function daysInRange(from: string, to: string): string[] {
  const start = dayjs(from).startOf("day");
  const end = dayjs(to).startOf("day");
  if (!start.isValid() || !end.isValid() || start.isAfter(end)) return [];
  const result: string[] = [];
  let cursor = start;
  while (!cursor.isAfter(end) && result.length < 31) {
    result.push(cursor.format(ISO_DATE));
    cursor = cursor.add(1, "day");
  }
  return result;
}

export function buildDaily(
  rows: HistoryRow[],
  from: string,
  to: string,
): DailyMovement[] {
  const keys = daysInRange(from, to);
  const counts = new Map<string, { inbound: number; outbound: number; reversal: number }>();
  for (const key of keys) counts.set(key, { inbound: 0, outbound: 0, reversal: 0 });

  for (const row of rows) {
    const key = parseDateTime(row.timestamp, BUSINESS_TIMEZONE).format(
      ISO_DATE,
    );
    const day = counts.get(key);
    if (!day) continue;
    if (row.type === "INBOUND") day.inbound += 1;
    else if (row.type === "OUTBOUND") day.outbound += 1;
    else day.reversal += 1;
  }

  return keys.map((key) => ({
    key,
    label: dayjs(key).format("DD/MM"),
    inbound: counts.get(key)?.inbound ?? 0,
    outbound: counts.get(key)?.outbound ?? 0,
    reversal: counts.get(key)?.reversal ?? 0,
  }));
}
