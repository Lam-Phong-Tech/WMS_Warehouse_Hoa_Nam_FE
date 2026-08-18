import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import type { DashboardKPI, DashboardQuery } from "../types";

/**
 * WWHN-327/WWHN-328: dashboard chỉ dùng aggregate contract chính thức.
 * Filter là date-only; timezone/cutoff do BE xử lý theo APP_TIMEZONE.
 */
export async function fetchDashboardKPI(
  query: DashboardQuery = {},
): Promise<DashboardKPI> {
  return http.get<DashboardKPI>(API_ENDPOINTS.DASHBOARD_KPI, {
    params: {
      ...(query.from_date ? { from_date: query.from_date } : {}),
      ...(query.to_date ? { to_date: query.to_date } : {}),
    },
  });
}
