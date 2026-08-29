import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { fetchDashboardOverview } from "../services/dashboardService";
import type { DashboardQuery } from "../types";

export function getHttpStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

export function useDashboardOverview(query: DashboardQuery, enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard", "overview", query.from_date, query.to_date],
    queryFn: () => fetchDashboardOverview(query),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      // 401/403/422 là câu trả lời cuối cùng của BE, retry chỉ nhân đôi lỗi.
      const status = getHttpStatus(error);
      if (status === 401 || status === 403 || status === 422) return false;
      return failureCount < 1;
    },
  });
}
