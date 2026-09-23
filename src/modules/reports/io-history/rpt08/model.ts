import dayjs from "dayjs";
import type { IoDocType, IoHistoryRow } from "../io-history-api";
import { ISO_DATE } from "../io-history-api";
import { tStatic as tUi } from "@/shared/i18n/useT";

export type PreviewState =
  | "loading"
  | "refreshing"
  | "empty"
  | "no-result"
  | "error"
  | "stale"
  | "invalid"
  | "readonly"
  | "exporting"
  | "export-failed"
  | "export-unknown"
  | null;

export type TransactionFilter = "ALL" | "INBOUND" | "OUTBOUND";
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
  type: Exclude<IoDocType, "REVERSAL">;
  objectPrimary: string;
  objectSecondary: string;
  quantity: number;
  actor: string;
  source?: IoHistoryRow;
};

export type DailyMovement = {
  key: string;
  label: string;
  inbound: number;
  outbound: number;
};

export const DEMO_FROM = dayjs("2026-09-04");
export const DEMO_TO = dayjs("2026-09-10");
export const EMPTY_FROM = dayjs("2026-09-11");
export const EMPTY_TO = dayjs("2026-09-17");
export const PAGE_SIZE = 5;
export const VI_TIMEZONE_LABEL = "Múi giờ Việt Nam";

const DEMO_DAILY: ReadonlyArray<DailyMovement> = [
  { key: "2026-09-04", label: "04/09", inbound: 44, outbound: 38 },
  { key: "2026-09-05", label: "05/09", inbound: 48, outbound: 44 },
  { key: "2026-09-06", label: "06/09", inbound: 51, outbound: 46 },
  { key: "2026-09-07", label: "07/09", inbound: 50, outbound: 49 },
  { key: "2026-09-08", label: "08/09", inbound: 55, outbound: 50 },
  { key: "2026-09-09", label: "09/09", inbound: 58, outbound: 55 },
  { key: "2026-09-10", label: "10/09", inbound: 50, outbound: 46 },
];

const DEMO_OBJECTS = [
  ["SKU HN-A01", "Lô LOT-260905"],
  ["SKU HN-B12", "Đại lý Minh Phát"],
  ["PAL-HN-0250", "Kệ A-05"],
  ["SKU HN-C03", "Đại lý Hoàng Gia"],
  ["SKU HN-D08", "Lô LOT-260904"],
  ["SKU HN-E16", "Lô LOT-260903"],
  ["PAL-HN-0312", "Kệ B-07"],
] as const;

const DEMO_ACTORS = [
  "Nguyễn Văn B",
  "Trần Thị C",
  "Lê Minh D",
  "Phạm Thị E",
] as const;

const DEMO_QUANTITIES = [120, 84, 96, 72, 150, 48, 64, 36, 108, 45] as const;

export function readPreviewState(params: URLSearchParams): PreviewState {
  const raw = (
    params.get("state") ??
    params.get("io-state") ??
    params.get("variant") ??
    ""
  )
    .trim()
    .toLowerCase();

  const aliases: Record<string, PreviewState> = {
    loading: "loading",
    "initial-loading": "loading",
    p02: "loading",
    refreshing: "refreshing",
    refresh: "refreshing",
    p03: "refreshing",
    empty: "empty",
    p04: "empty",
    "no-result": "no-result",
    "no-search-result": "no-result",
    p05: "no-result",
    error: "error",
    "load-error": "error",
    p06: "error",
    stale: "stale",
    partial: "stale",
    "partial-stale": "stale",
    p08: "stale",
    invalid: "invalid",
    "invalid-date": "invalid",
    "invalid-date-range": "invalid",
    p09: "invalid",
    readonly: "readonly",
    "read-only": "readonly",
    p10: "readonly",
    exporting: "exporting",
    p11: "exporting",
    "export-failed": "export-failed",
    p14: "export-failed",
    "export-unknown": "export-unknown",
    "export-timeout": "export-unknown",
    "export-timeout-unknown": "export-unknown",
    p15: "export-unknown",
  };

  return aliases[raw] ?? null;
}

export function number(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(value)));
}

export function percent(value: number): string {
  return value.toFixed(1).replace(".", ",") + "%";
}

export function displayStamp(value: string): string {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return "—";
  return parsed.format("DD/MM/YYYY · HH:mm");
}

export function displayDay(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "—";
}

export function displayAsOf(value: string, demo: boolean): string {
  if (demo) return "10/09/2026 · 16:45";
  const parsed = dayjs(value);
  return parsed.isValid()
    ? parsed.format("DD/MM/YYYY · HH:mm")
    : tUi("updatedUi.text_b495069027b3");
}

export function compactRange(from: string, to: string): string {
  const start = dayjs(from);
  const end = dayjs(to);
  if (!start.isValid() || !end.isValid()) return "—";
  if (start.month() === end.month() && start.year() === end.year()) {
    return `${start.format("DD")}–${end.format("DD/MM/YYYY")}`;
  }
  return `${start.format("DD/MM/YYYY")}–${end.format("DD/MM/YYYY")}`;
}

function parseObject(row: IoHistoryRow): [string, string] {
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
  if (row.type === "REVERSAL") return null;
  const [objectPrimary, objectSecondary] = parseObject(row);
  return {
    id: row.id || row.documentNo,
    timestamp: row.postedAt || row.createdAt,
    documentNo: row.documentNo || "—",
    type: row.type,
    objectPrimary,
    objectSecondary,
    quantity: Math.abs(row.qty ?? 0),
    actor: row.actor || "—",
    source: row,
  };
}

export function makeDemoRows(): HistoryRow[] {
  const rows: HistoryRow[] = [
    {
      id: "demo-1",
      timestamp: "2026-09-10T16:42:00+07:00",
      documentNo: "PN-260910-024",
      type: "INBOUND",
      objectPrimary: "SKU HN-A01",
      objectSecondary: "Lô LOT-260905",
      quantity: 120,
      actor: "Nguyễn Văn B",
    },
    {
      id: "demo-2",
      timestamp: "2026-09-10T15:30:00+07:00",
      documentNo: "PX-260910-019",
      type: "OUTBOUND",
      objectPrimary: "SKU HN-B12",
      objectSecondary: "Đại lý Minh Phát",
      quantity: 84,
      actor: "Trần Thị C",
    },
    {
      id: "demo-3",
      timestamp: "2026-09-10T14:55:00+07:00",
      documentNo: "PN-260910-023",
      type: "INBOUND",
      objectPrimary: "PAL-HN-0250",
      objectSecondary: "Kệ A-05",
      quantity: 96,
      actor: "Lê Minh D",
    },
    {
      id: "demo-4",
      timestamp: "2026-09-10T14:20:00+07:00",
      documentNo: "PX-260910-018",
      type: "OUTBOUND",
      objectPrimary: "SKU HN-C03",
      objectSecondary: "Đại lý Hoàng Gia",
      quantity: 72,
      actor: "Phạm Thị E",
    },
    {
      id: "demo-5",
      timestamp: "2026-09-10T13:48:00+07:00",
      documentNo: "PN-260910-022",
      type: "INBOUND",
      objectPrimary: "SKU HN-D08",
      objectSecondary: "Lô LOT-260904",
      quantity: 150,
      actor: "Nguyễn Văn B",
    },
  ];

  const usedOnLastDay = { INBOUND: 3, OUTBOUND: 2 } as const;
  let sequence = 100;

  for (const day of [...DEMO_DAILY].reverse()) {
    const dayToken = day.key.replace(/-/g, "").slice(2);
    for (const type of ["INBOUND", "OUTBOUND"] as const) {
      const target = type === "INBOUND" ? day.inbound : day.outbound;
      const used = day.key === "2026-09-10" ? usedOnLastDay[type] : 0;
      const remaining = Math.max(0, target - used);
      const start = dayjs(
        `${day.key}T${day.key === "2026-09-10" ? "13:30" : "18:00"}:00+07:00`,
      );
      for (let index = 0; index < remaining; index += 1) {
        const [objectPrimary, objectSecondary] =
          DEMO_OBJECTS[(sequence + index) % DEMO_OBJECTS.length];
        const prefix = type === "INBOUND" ? "PN" : "PX";
        rows.push({
          id: `demo-${day.key}-${type}-${index}`,
          timestamp: start.subtract(index * 4, "minute").toISOString(),
          documentNo: `${prefix}-${dayToken}-${String(sequence).padStart(3, "0")}`,
          type,
          objectPrimary,
          objectSecondary,
          quantity:
            DEMO_QUANTITIES[(sequence + index) % DEMO_QUANTITIES.length],
          actor: DEMO_ACTORS[(sequence + index) % DEMO_ACTORS.length],
        });
        sequence += 1;
      }
    }
  }

  return rows.sort(
    (left, right) =>
      dayjs(right.timestamp).valueOf() - dayjs(left.timestamp).valueOf(),
  );
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
  const counts = new Map<string, { inbound: number; outbound: number }>();
  for (const key of keys) counts.set(key, { inbound: 0, outbound: 0 });

  for (const row of rows) {
    const key = dayjs(row.timestamp).format(ISO_DATE);
    const day = counts.get(key);
    if (!day) continue;
    if (row.type === "INBOUND") day.inbound += 1;
    else day.outbound += 1;
  }

  return keys.map((key) => ({
    key,
    label: dayjs(key).format("DD/MM"),
    inbound: counts.get(key)?.inbound ?? 0,
    outbound: counts.get(key)?.outbound ?? 0,
  }));
}
