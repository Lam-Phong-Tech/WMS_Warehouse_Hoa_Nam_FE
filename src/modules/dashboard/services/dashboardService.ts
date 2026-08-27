import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import type { DashboardKPI, DashboardQuery } from "../types";

/**
 * WWHN-327/WWHN-328: dashboard chỉ dùng aggregate contract chính thức.
 * Filter là date-only; timezone/cutoff do BE xử lý theo APP_TIMEZONE.
 *
 * Part 4 (phòng thủ): BE/proxy trả payload thiếu field (partial contract)
 * từng làm CRASH trắng cả dashboard (`data.period.from_date`,
 * `Object.entries(warranty_cases_by_status)`...). Normalize fail-soft về
 * giá trị rỗng an toàn — dashboard hiển thị trạng thái 0/EMPTY thay vì chết;
 * số liệu THẬT không bị đổi khi contract đầy đủ.
 */
export function normalizeDashboardKPI(
  raw: Partial<DashboardKPI> | null | undefined,
): DashboardKPI {
  const source = raw ?? {};
  return {
    period: source.period,
    data_scope: source.data_scope ?? "GLOBAL",
    scope_warehouse_ids: source.scope_warehouse_ids ?? null,
    available_qty: source.available_qty ?? 0,
    receipt_qty: source.receipt_qty ?? 0,
    issue_qty: source.issue_qty ?? 0,
    component_issue_qty: source.component_issue_qty ?? 0,
    reversal_net: source.reversal_net ?? 0,
    warranty_cases_by_status: source.warranty_cases_by_status ?? {},
    reconciliation_warning_count: source.reconciliation_warning_count ?? 0,
    reconciliation_warnings: source.reconciliation_warnings ?? [],
    below_min_stock_count: source.below_min_stock_count ?? 0,
    below_min_stock_skus: source.below_min_stock_skus ?? [],
    above_max_stock_count: source.above_max_stock_count ?? 0,
    above_max_stock_skus: source.above_max_stock_skus ?? [],
    daily: source.daily ?? [],
  };
}

export async function fetchDashboardKPI(
  query: DashboardQuery = {},
): Promise<DashboardKPI> {
  const raw = await http.get<Partial<DashboardKPI>>(
    API_ENDPOINTS.DASHBOARD_KPI,
    {
      params: {
        ...(query.from_date ? { from_date: query.from_date } : {}),
        ...(query.to_date ? { to_date: query.to_date } : {}),
      },
    },
  );
  return normalizeDashboardKPI(raw);
}
