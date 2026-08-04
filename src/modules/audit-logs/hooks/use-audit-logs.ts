import { useQuery, useQueryClient } from "@tanstack/react-query";
import { auditLogService } from "../services/audit-logs.service";
import type { AuditLogFilters } from "../types/audit-logs.types";

/**
 * Hook để lấy danh sách audit logs với pagination và filters
 */
export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => auditLogService.getAuditLogs(filters),
    // Giữ cache trong 30 giây để tránh gọi API liên tục khi thay đổi filter
    staleTime: 30 * 1000,
  });
}

/**
 * Hook để refresh danh sách audit logs (sau khi có thay đổi)
 */
export function useRefreshAuditLogs() {
  const queryClient = useQueryClient();

  return {
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  };
}
