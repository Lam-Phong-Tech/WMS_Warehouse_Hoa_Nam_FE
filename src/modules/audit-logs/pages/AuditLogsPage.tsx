import { useState } from "react";
import { Card } from "antd";
import {
  PageHeader,
  ApiErrorAlert,
  EmptyState,
  LoadingState,
} from "@/shared/components";
import { AuditLogsTable } from "@/modules/audit-logs/components/AuditLogsTable";
import { AuditLogDetailDrawer } from "@/modules/audit-logs/components/AuditLogDetailDrawer";
import { useAuditLogs } from "@/modules/audit-logs/hooks/use-audit-logs";
import type { AuditLog } from "@/modules/audit-logs/types/audit-logs.types";

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [sortBy, setSortBy] = useState<string>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">();

  const { data, isLoading, isError, error, refetch } = useAuditLogs({
    page,
    limit: perPage,
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  const auditLogs = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Nhật ký hệ thống"
        subtitle="Lịch sử thay đổi và thao tác quan trọng để phục vụ kiểm tra, đối chiếu khi cần."
      />

      {isError && (
        <ApiErrorAlert
          error={error}
          title="Không tải được nhật ký hệ thống"
          onRetry={refetch}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card variant="borderless">
        {isLoading && auditLogs.length === 0 ? (
          <LoadingState tip="Đang tải nhật ký hệ thống..." minHeight={320} />
        ) : !isLoading && auditLogs.length === 0 ? (
          <EmptyState
            title="Chưa có nhật ký hệ thống"
            description="Hệ thống chưa ghi nhận bản ghi nào."
          />
        ) : (
          <AuditLogsTable
            data={auditLogs}
            loading={isLoading}
            page={page}
            perPage={perPage}
            total={total}
            onPaginationChange={(p, ps) => {
              setPage(p);
              setPerPage(ps);
            }}
            onSortChange={(field, order) => {
              setSortBy(field);
              setSortOrder(order);
              setPage(1);
            }}
            onView={(log) => setSelectedLog(log)}
          />
        )}
      </Card>

      <AuditLogDetailDrawer
        open={selectedLog !== null}
        auditLog={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}
