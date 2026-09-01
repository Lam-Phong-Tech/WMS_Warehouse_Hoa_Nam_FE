/**
 * Tầng dữ liệu của màn "Tổng quan vận hành" (bản dựng theo demo UI/UX
 * `10.WMS_Hoa_Nam_Trang_Tong_Quan.html`).
 *
 * NGUYÊN TẮC: demo là bản mẫu chạy trên fixture cứng; ở đây MỌI con số phải đến
 * từ endpoint thật, không suy diễn. Bốn nguồn đọc (đều cần `report.view`):
 *
 *  1. GET /reports/dashboard-overview  — KPI tách product/component, chuỗi luồng
 *     4 chiều, tồn cuối ngày, cơ cấu tồn, bảo hành, vấn đề cần xử lý.
 *  2. GET /reports/inventory-xnt-enhanced — sổ Nhập-Xuất-Tồn theo SKU: nguồn của
 *     khối "Đối soát tồn theo kỳ" (opening + receipt_net − issue_net −
 *     component_issue_net + reversal_unlinked_net = closing), Top 5 SKU xuất và
 *     số SKU đang có hàng.
 *  3. GET /reports/inventory-xnt-daily — chuỗi `reversal_net` theo NGÀY: chiều
 *     "Hoàn tác" của biểu đồ luồng (dashboard-overview không phát hành chiều này).
 *  4. GET /reports/dashboard-quick — `below_min_stock_count`/`above_max_stock_count`
 *     cho thẻ "Cảnh báo tồn và dữ liệu" (dashboard-overview chưa có `stock_threshold`).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { OPERATIONS_REPORT_ENDPOINTS } from "@/modules/reports/operations/report-data";
import type { DashboardOverview, SkuTypeFilter } from "../types";

export type OverviewPeriod = "today" | "last7" | "month" | "custom";

export const PERIOD_NAMES: Record<OverviewPeriod, string> = {
  today: "Hôm nay",
  last7: "7 ngày gần nhất",
  month: "Tháng này",
  custom: "Tùy chọn",
};

export interface DateRange {
  from: string;
  to: string;
}

const ISO = "YYYY-MM-DD";

/** Kỳ đang xem theo lựa chọn bộ lọc; `custom` dùng nguyên 2 ngày người dùng chọn. */
export function resolvePeriodRange(
  period: OverviewPeriod,
  custom: DateRange,
): DateRange {
  const today = dayjs();
  if (period === "today")
    return { from: today.format(ISO), to: today.format(ISO) };
  if (period === "last7")
    return { from: today.subtract(6, "day").format(ISO), to: today.format(ISO) };
  if (period === "month")
    return { from: today.startOf("month").format(ISO), to: today.format(ISO) };
  return custom;
}

/** Kỳ liền trước, cùng độ dài — dùng cho các delta "so với kỳ trước". */
export function previousRange(range: DateRange): DateRange {
  const from = dayjs(range.from);
  const to = dayjs(range.to);
  const days = Math.max(to.diff(from, "day") + 1, 1);
  return {
    from: from.subtract(days, "day").format(ISO),
    to: from.subtract(1, "day").format(ISO),
  };
}

const numberFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

export function fmt(value: number): string {
  return numberFormat.format(value);
}

/** Dấu trừ của demo là U+2212 (−), không phải hyphen. */
export function fmtDelta(value: number, suffix = ""): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${numberFormat.format(Math.abs(value))}${suffix}`;
}

export type Trend = "up" | "down" | "neutral";

export function trendOf(value: number): Trend {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "neutral";
}

// ── Nguồn 2/3/4: kiểu tối thiểu của phần payload màn này dùng ─────────────

interface XntLine {
  product_code?: string;
  product_name?: string;
  opening?: number;
  receipt_net?: number;
  issue_net?: number;
  component_issue_net?: number;
  reversal_unlinked_net?: number;
  closing?: number;
}

interface XntReport {
  lines?: XntLine[];
}

interface XntDailyPoint {
  date?: string;
  inbound_qty?: number;
  outbound_qty?: number;
  reversal_net?: number;
  closing_qty?: number;
}

interface XntDailyReport {
  days?: XntDailyPoint[];
}

interface DashboardQuick {
  below_min_stock_count?: number;
  above_max_stock_count?: number;
  reconciliation_warning_count?: number;
}

const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const STALE_MS = 60_000;
/** Demo ghi "Tự động làm mới sau 60 giây" — làm đúng như vậy, không chỉ ghi chữ. */
const AUTO_REFRESH_MS = 60_000;

function reportQueryOptions(enabled: boolean) {
  return {
    enabled,
    staleTime: STALE_MS,
    refetchInterval: AUTO_REFRESH_MS,
    retry: (failureCount: number, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 403 || status === 422) return false;
      return failureCount < 1;
    },
  };
}

/**
 * Nguồn 1 — bản đọc riêng của màn này: kỳ yêu cầu được NỚI về phía trước đúng
 * một kỳ để tính được delta "so với kỳ trước" và tồn đầu kỳ mà chỉ tốn 1 request.
 */
export function useOverviewSource(range: DateRange, enabled: boolean) {
  const widened = useMemo(() => {
    const previous = previousRange(range);
    return { from: previous.from, to: range.to };
  }, [range]);

  const overview = useQuery({
    queryKey: ["dashboard", "overview-vuexy", widened.from, widened.to],
    queryFn: () =>
      http.get<DashboardOverview>(API_ENDPOINTS.REPORTS_DASHBOARD_OVERVIEW, {
        params: { from_date: widened.from, to_date: widened.to },
      }),
    ...reportQueryOptions(enabled),
  });

  const xnt = useQuery({
    queryKey: ["dashboard", "overview-xnt", range.from, range.to],
    queryFn: () =>
      http.get<XntReport>(API_ENDPOINTS.REPORTS_XNT_ENHANCED, {
        params: { from_date: range.from, to_date: range.to },
      }),
    ...reportQueryOptions(enabled),
  });

  const xntDaily = useQuery({
    queryKey: ["dashboard", "overview-xnt-daily", range.from, range.to],
    queryFn: () =>
      http.get<XntDailyReport>(OPERATIONS_REPORT_ENDPOINTS.XNT_DAILY, {
        params: { from_date: range.from, to_date: range.to },
      }),
    ...reportQueryOptions(enabled),
  });

  const quick = useQuery({
    queryKey: ["dashboard", "overview-quick", range.from, range.to],
    queryFn: () =>
      http.get<DashboardQuick>(API_ENDPOINTS.DASHBOARD_KPI, {
        params: { from_date: range.from, to_date: range.to },
      }),
    ...reportQueryOptions(enabled),
  });

  return { overview, xnt, xntDaily, quick };
}

export type OverviewSource = ReturnType<typeof useOverviewSource>;

// ── Dẫn xuất ─────────────────────────────────────────────────────────────

export interface FlowRow {
  date: string;
  label: string;
  inbound: number;
  product: number;
  component: number;
  reversal: number;
}

/**
 * Chuỗi luồng theo NGÀY trong đúng kỳ đang xem.
 *
 * `inbound` gộp receipt_product/receipt_component theo chiều loại hàng đang lọc;
 * `reversal` lấy từ nguồn 3 vì dashboard-overview không phát hành chiều này.
 */
export function buildFlowRows(
  overview: DashboardOverview | undefined,
  daily: XntDailyReport | undefined,
  range: DateRange,
  type: SkuTypeFilter,
): FlowRow[] {
  const reversalByDate = new Map<string, number>();
  for (const point of daily?.days ?? []) {
    if (point.date) reversalByDate.set(point.date, num(point.reversal_net));
  }
  return (overview?.flow_daily ?? [])
    .filter((point) => point.date >= range.from && point.date <= range.to)
    .map((point) => ({
      date: point.date,
      label: dayjs(point.date).format("DD/MM"),
      inbound:
        type === "PRODUCT"
          ? num(point.receipt_product)
          : type === "COMPONENT"
            ? num(point.receipt_component)
            : num(point.receipt_product) + num(point.receipt_component),
      product: num(point.issue_product),
      component: num(point.issue_component),
      reversal: reversalByDate.get(point.date) ?? 0,
    }));
}

export interface FlowTotals {
  inbound: number;
  product: number;
  component: number;
  reversal: number;
}

export function sumFlow(rows: FlowRow[]): FlowTotals {
  return rows.reduce<FlowTotals>(
    (total, row) => ({
      inbound: total.inbound + row.inbound,
      product: total.product + row.product,
      component: total.component + row.component,
      reversal: total.reversal + row.reversal,
    }),
    { inbound: 0, product: 0, component: 0, reversal: 0 },
  );
}

/** Tổng luồng của KỲ TRƯỚC — cùng payload đã nới, không tốn thêm request. */
export function sumPreviousFlow(
  overview: DashboardOverview | undefined,
  range: DateRange,
  type: SkuTypeFilter,
): FlowTotals {
  const previous = previousRange(range);
  const rows = (overview?.flow_daily ?? [])
    .filter((point) => point.date >= previous.from && point.date <= previous.to)
    .map((point) => ({
      date: point.date,
      label: "",
      inbound:
        type === "PRODUCT"
          ? num(point.receipt_product)
          : type === "COMPONENT"
            ? num(point.receipt_component)
            : num(point.receipt_product) + num(point.receipt_component),
      product: num(point.issue_product),
      component: num(point.issue_component),
      reversal: 0,
    }));
  return sumFlow(rows);
}

export interface TrendRow {
  date: string;
  label: string;
  closing: number;
}

export function buildTrendRows(
  overview: DashboardOverview | undefined,
  range: DateRange,
): TrendRow[] {
  return (overview?.stock_trend ?? [])
    .filter((point) => point.date >= range.from && point.date <= range.to)
    .map((point) => ({
      date: point.date,
      label: dayjs(point.date).format("DD/MM"),
      closing: num(point.closing_qty),
    }));
}

export interface EquationTotals {
  opening: number;
  receipt: number;
  issueProduct: number;
  issueComponent: number;
  reversal: number;
  closing: number;
  /** closing − (opening + receipt − issue − component + reversal). 0 = khớp. */
  difference: number;
}

/**
 * Đối soát tồn theo kỳ — CỘNG THẲNG các cột của sổ XNT, không suy ngược số hạng
 * nào. Ba chữ số cuối được làm tròn vì tổng số thực có thể lệch ~1e-10.
 */
export function buildEquation(xnt: XntReport | undefined): EquationTotals {
  const lines = xnt?.lines ?? [];
  const sum = (pick: (line: XntLine) => number | undefined) =>
    lines.reduce((total, line) => total + num(pick(line)), 0);
  const opening = sum((line) => line.opening);
  const receipt = sum((line) => line.receipt_net);
  const issueProduct = sum((line) => line.issue_net);
  const issueComponent = sum((line) => line.component_issue_net);
  const reversal = sum((line) => line.reversal_unlinked_net);
  const closing = sum((line) => line.closing);
  const expected =
    opening + receipt - issueProduct - issueComponent + reversal;
  return {
    opening,
    receipt,
    issueProduct,
    issueComponent,
    reversal,
    closing,
    difference: Math.round((closing - expected) * 1000) / 1000,
  };
}

export interface TopSkuRow {
  code: string;
  name: string;
  value: number;
}

/**
 * Top 5 SKU xuất — gộp các dòng XNT (mỗi dòng là SKU × kho × trạng thái) về
 * từng SKU rồi xếp theo lượng xuất thuần giảm dần.
 */
export function buildTopSkus(xnt: XntReport | undefined): TopSkuRow[] {
  const byCode = new Map<string, TopSkuRow>();
  for (const line of xnt?.lines ?? []) {
    const code = String(line.product_code ?? "").trim();
    if (code === "") continue;
    const existing = byCode.get(code);
    const value = num(line.issue_net);
    if (existing) existing.value += value;
    else
      byCode.set(code, {
        code,
        name: String(line.product_name ?? "").trim(),
        value,
      });
  }
  return [...byCode.values()]
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

/** Số SKU đang có hàng = số SKU có tồn cuối kỳ > 0 trên sổ XNT. */
export function countSkusInStock(xnt: XntReport | undefined): {
  closing: number;
  opening: number;
} {
  const closingByCode = new Map<string, number>();
  const openingByCode = new Map<string, number>();
  for (const line of xnt?.lines ?? []) {
    const code = String(line.product_code ?? "").trim();
    if (code === "") continue;
    closingByCode.set(code, (closingByCode.get(code) ?? 0) + num(line.closing));
    openingByCode.set(code, (openingByCode.get(code) ?? 0) + num(line.opening));
  }
  const positive = (map: Map<string, number>) =>
    [...map.values()].filter((value) => value > 0).length;
  return { closing: positive(closingByCode), opening: positive(openingByCode) };
}

/** Trạng thái hồ sơ bảo hành coi là ĐÃ ĐÓNG — phần còn lại là đang xử lý. */
const WARRANTY_CLOSED_STATUSES = new Set([
  "COMPLETED",
  "RETURNED",
  "RETURNED_TO_CUSTOMER",
  "CLOSED",
  "CANCELLED",
]);

export function countActiveWarranty(
  overview: DashboardOverview | undefined,
): number {
  return Object.entries(overview?.warranty.by_status ?? {}).reduce(
    (total, [status, count]) =>
      WARRANTY_CLOSED_STATUSES.has(status) ? total : total + num(count),
    0,
  );
}

export function oldestOverdueDays(
  overview: DashboardOverview | undefined,
): number {
  return (overview?.warranty.overdue_sample ?? []).reduce(
    (max, item) => Math.max(max, num(item.days_overdue)),
    0,
  );
}

/** Cơ cấu tồn theo trạng thái, gộp theo chiều loại hàng đang lọc. */
export function buildComposition(
  overview: DashboardOverview | undefined,
  type: SkuTypeFilter,
): Array<{ status: string; label: string; value: number; pct: number }> {
  const structure = overview?.stock_structure;
  const pick = (status: "AVAILABLE" | "QUARANTINE" | "NON_SELLABLE" | "DEFECTIVE") => {
    const product = num(structure?.PRODUCT?.[status]);
    const component = num(structure?.COMPONENT?.[status]);
    if (type === "PRODUCT") return product;
    if (type === "COMPONENT") return component;
    return product + component;
  };
  // Thứ tự và màu giữ đúng demo: khả dụng → cách ly → không bán được → lỗi.
  const rows = [
    { status: "AVAILABLE", label: "Khả dụng", value: pick("AVAILABLE") },
    { status: "QUARANTINE", label: "Cách ly", value: pick("QUARANTINE") },
    {
      status: "NON_SELLABLE",
      label: "Không bán được",
      value: pick("NON_SELLABLE"),
    },
    { status: "DEFECTIVE", label: "Hàng lỗi", value: pick("DEFECTIVE") },
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({
    ...row,
    pct: total > 0 ? Math.round((row.value / total) * 100) : 0,
  }));
}

export type Severity = "P0" | "P1" | "P2";

/** Nhãn tiếng Việt của mức độ; mã nội bộ P0/P1/P2 chỉ đi kèm ở tooltip/data-attr. */
export const SEVERITY_NAMES: Record<Severity, string> = {
  P0: "Khẩn cấp",
  P1: "Cần xử lý sớm",
  P2: "Theo dõi",
};

export function overviewTypeKey(
  type: SkuTypeFilter,
): "product" | "component" | "total" {
  if (type === "PRODUCT") return "product";
  if (type === "COMPONENT") return "component";
  return "total";
}
