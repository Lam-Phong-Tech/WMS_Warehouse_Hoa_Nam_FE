import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import type {
  DashboardOverview,
  DashboardQuery,
  DashboardSkuSplit,
  DashboardStockStatusSplit,
} from "../types";

/**
 * Dashboard chỉ dùng aggregate contract chính thức. Filter là date-only;
 * timezone/cutoff do BE xử lý theo APP_TIMEZONE.
 *
 * Phòng thủ fail-soft: BE/proxy trả payload thiếu field (partial contract) từng làm
 * CRASH trắng cả dashboard (`data.period.from_date`, `Object.entries(...)`).
 * Normalize về giá trị rỗng an toàn — màn hình hiển thị trạng thái 0/EMPTY thay vì
 * chết; số liệu THẬT không bị đổi khi contract đầy đủ.
 */
const EMPTY_SPLIT: DashboardSkuSplit = { product: 0, component: 0, total: 0 };

const EMPTY_STATUS_SPLIT: DashboardStockStatusSplit = {
  AVAILABLE: 0,
  NON_SELLABLE: 0,
  DEFECTIVE: 0,
  QUARANTINE: 0,
};

function split(raw: Partial<DashboardSkuSplit> | undefined): DashboardSkuSplit {
  const product = raw?.product ?? 0;
  const component = raw?.component ?? 0;
  return { product, component, total: raw?.total ?? product + component };
}

function statusSplit(
  raw: Partial<DashboardStockStatusSplit> | undefined,
): DashboardStockStatusSplit {
  return { ...EMPTY_STATUS_SPLIT, ...(raw ?? {}) };
}

export function normalizeDashboardOverview(
  raw: Partial<DashboardOverview> | null | undefined,
): DashboardOverview {
  const source = raw ?? {};
  const kpi = source.kpi;
  const structure = source.stock_structure;
  return {
    period: source.period ?? { from_date: "", to_date: "" },
    data_scope: source.data_scope ?? "GLOBAL",
    scope_warehouse_ids: source.scope_warehouse_ids ?? null,
    kpi: {
      on_hand: split(kpi?.on_hand ?? EMPTY_SPLIT),
      receipt_today: split(kpi?.receipt_today),
      issue_today: split(kpi?.issue_today),
      receipt_month: split(kpi?.receipt_month),
      issue_month: split(kpi?.issue_month),
    },
    warranty_received: {
      today: source.warranty_received?.today ?? 0,
      week: source.warranty_received?.week ?? 0,
      month: source.warranty_received?.month ?? 0,
    },
    top_sku: {
      best: source.top_sku?.best ?? null,
      worst: source.top_sku?.worst ?? null,
    },
    flow_daily: source.flow_daily ?? [],
    stock_trend: source.stock_trend ?? [],
    stock_structure: {
      PRODUCT: statusSplit(structure?.PRODUCT),
      COMPONENT: statusSplit(structure?.COMPONENT),
    },
    warranty: {
      by_status: source.warranty?.by_status ?? {},
      overdue_count: source.warranty?.overdue_count ?? 0,
      overdue_sample: source.warranty?.overdue_sample ?? [],
    },
    issues: {
      inventory_mismatch: source.issues?.inventory_mismatch ?? 0,
      import_error: source.issues?.import_error ?? 0,
      warranty_overdue: source.issues?.warranty_overdue ?? 0,
      print_failed: source.issues?.print_failed ?? 0,
      sku_pending_info: source.issues?.sku_pending_info ?? 0,
    },
  };
}

export async function fetchDashboardOverview(
  query: DashboardQuery = {},
): Promise<DashboardOverview> {
  const raw = await http.get<Partial<DashboardOverview>>(
    API_ENDPOINTS.REPORTS_DASHBOARD_OVERVIEW,
    {
      params: {
        ...(query.from_date ? { from_date: query.from_date } : {}),
        ...(query.to_date ? { to_date: query.to_date } : {}),
        ...(query.warehouse_id ? { warehouse_id: query.warehouse_id } : {}),
      },
    },
  );
  return normalizeDashboardOverview(raw);
}
