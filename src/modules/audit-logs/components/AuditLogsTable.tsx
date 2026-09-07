import { rowIndexOfBy } from "@/shared/components/data-display/row-index";
import { useT } from "@/shared/i18n/useT";
import { useState } from "react";
import {
  Box,
  Stack,
  UiStatusBadge,
  type UiStatusTone,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
} from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import type { ClientSortState } from "@/shared/components/data-display/useClientSort";
import { tableEmptyText } from "@/shared/components/feedback/BusinessState";
import {
  MvpSelectionCheckbox,
  mvpRowNumber,
} from "@/shared/components/mvp/MvpSelectionCell";
import type { RowSelectionState } from "@/shared/hooks/useRowSelection";
import type { AuditLog } from "../types/audit-logs.types";
import { formatDateTime } from "@/shared/utils/format-date";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_MODULE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { ActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";

// Map preset màu antd Tag cũ → tone UiStatusBadge (recipe Part 4:
// green→success, blue/cyan→info, red/magenta→error, orange→warning,
// purple→primary, gray→neutral, lime→success).
const ACTION_TONES: Record<string, UiStatusTone> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "error",
  REVOKE_ROLE_SCOPE: "warning",
  SYNC_ROLE_SCOPES: "primary",
  SUBMIT: "info",
  CANCEL: "error",
  ARCHIVE: "neutral",
  RESTORE: "success",
};

/** Chữ trong ô bảng (thay Typography body2). */
const CELL_TEXT_SX = {
  fontSize: TYPOGRAPHY.fontSizeSecondary,
  color: S.textHigh,
} as const;

/**
 * UUID đối tượng dài 36 ký tự: in nguyên vào ô bảng thì cột tự xuống 6 dòng và
 * đẩy các cột sau (kể cả nút Xem) ra ngoài màn hình. Rút gọn ở bảng, giá trị
 * đầy đủ nằm ở tooltip và ở Dialog "Chi tiết nhật ký hệ thống".
 */
function shortAuditId(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

export interface AuditLogsTableProps {
  data: AuditLog[];
  loading?: boolean;
  /** Lỗi tải danh sách — quyết định câu chữ dòng trống (xem `tableEmptyText`). */
  error?: unknown;
  /** Trang/số dòng hiện tại để STT chạy liên tục giữa các trang. */
  page: number;
  perPage: number;
  selection: RowSelectionState;
  onView?: (auditLog: AuditLog) => void;
  /**
   * Sắp xếp server-side (thời gian, hành động, phân hệ, đối tượng, IP — BE
   * nhận sort_by/sort_order, xem AuditLogsPage/use-audit-logs). Bấm header cột
   * gọi callback này qua `sortState`/`onSortChange` (có kiểm soát) của
   * `ResponsiveDataTable` — cùng chu kỳ 3 trạng thái (chưa sort → tăng dần →
   * giảm dần → bỏ sort) như trước.
   */
  onSortChange?: (field?: string, order?: "asc" | "desc") => void;
}

export function AuditLogsTable({
  data,
  loading,
  error,
  page,
  perPage,
  selection,
  onView,
  onSortChange,
}: AuditLogsTableProps) {
  const t = useT();
  const [sortState, setSortState] = useState<ClientSortState>({
    direction: undefined,
  });

  const handleSortChange = (key: string) => {
    setSortState((prev) => {
      const next: ClientSortState =
        prev.key !== key
          ? { key, direction: "asc" }
          : prev.direction === "asc"
            ? { key, direction: "desc" }
            : { key: undefined, direction: undefined };
      onSortChange?.(next.key, next.direction);
      return next;
    });
  };

  const columns: ResponsiveTableColumn<AuditLog>[] = [
    {
      key: "select",
      // Ô chọn nằm trong dòng bấm-để-xem-chi-tiết: chặn nổi bọt để tick checkbox
      // không mở luôn Dialog chi tiết.
      header: (
        <MvpSelectionCheckbox
          checked={selection.isAllSelected}
          indeterminate={selection.isIndeterminate}
          onChange={selection.toggleAll}
          ariaLabel={t("audit.selectAllAria")}
        />
      ),
      width: 44,
      align: "center",
      hideOnMobile: true,
      render: (row) => (
        <span role="presentation" onClick={(event) => event.stopPropagation()}>
          <MvpSelectionCheckbox
            checked={selection.isSelected(row.id)}
            onChange={(checked) => selection.toggleOne(row.id, checked)}
            ariaLabel={t("audit.selectRowAria", {
              time: formatDateTime(row.created_at),
            })}
          />
        </span>
      ),
    },
    {
      key: "stt",
      header: "STT",
      width: 56,
      align: "center",
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(
          page,
          perPage,
          rowIndexOfBy(data, row, (item) => item.id),
        ),
    },
    {
      key: "created_at",
      header: t("audit.colTime"),
      width: 150,
      sortable: true,
      render: (row) => (
        <Box sx={{ ...CELL_TEXT_SX, whiteSpace: "nowrap" }}>
          {formatDateTime(row.created_at)}
        </Box>
      ),
    },
    {
      key: "action",
      header: t("audit.colAction"),
      width: 170,
      sortable: true,
      render: (row) => (
        <UiStatusBadge
          tone={ACTION_TONES[row.action] ?? "neutral"}
          label={businessLabel(
            AUDIT_ACTION_LABELS,
            row.action,
            t("audit.actionOther"),
          )}
        />
      ),
    },
    {
      key: "module",
      header: t("audit.colModule"),
      width: 150,
      sortable: true,
      render: (row) => (
        <Box sx={CELL_TEXT_SX}>
          {AUDIT_MODULE_LABELS[row.module] || t("audit.moduleOther")}
        </Box>
      ),
    },
    {
      key: "object_type",
      header: t("audit.colObject"),
      width: 180,
      hideOnMobile: true,
      sortable: true,
      render: (row) => (
        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Box
            sx={{
              ...CELL_TEXT_SX,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {row.object_type || EMPTY_TEXT}
          </Box>
          {/* title giữ UUID đầy đủ CÓ CHỦ ĐÍCH: đây là màn nhật ký kỹ thuật cho
            quản trị, phần hiển thị đã rút gọn để không vỡ cột và bản đầy đủ chỉ
            hiện khi rê chuột — quyết định cũ, khoá bởi AuditLogsPage.test.tsx. */}
          {row.object_id ? (
            <Box
              title={row.object_id}
              sx={{
                fontSize: 11,
                color: S.textMedium,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {`#${shortAuditId(row.object_id)}`}
            </Box>
          ) : null}
        </Stack>
      ),
    },
    {
      key: "actor_email",
      header: t("audit.colActor"),
      width: 190,
      render: (row) => {
        const actor =
          row.actor?.email || row.actor?.display_name || t("audit.system");
        return (
          <Box
            title={actor}
            sx={{
              ...CELL_TEXT_SX,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {actor}
          </Box>
        );
      },
    },
    {
      key: "ip_address",
      header: t("audit.colIp"),
      width: 130,
      hideOnMobile: true,
      sortable: true,
      render: (row) => (
        <Box sx={{ ...CELL_TEXT_SX, whiteSpace: "nowrap" }}>
          {row.ip_address || EMPTY_TEXT}
        </Box>
      ),
    },
    {
      key: "description",
      header: t("audit.colDescription"),
      // Mô tả audit log thường kèm UUID nên rất dài; để nguyên thì ô nở hết cỡ
      // và đẩy cả bảng tràn ngang, buộc người xem phải kéo thanh cuộn. Chặn trần
      // bề rộng rồi cắt bằng "…" — nội dung đầy đủ vẫn có ở tooltip và ở Dialog
      // chi tiết. KHÔNG đặt `width` cho cột: cột cố định càng làm bảng rộng thêm.
      render: (row) => (
        <Box
          title={row.description}
          sx={{
            ...CELL_TEXT_SX,
            maxWidth: 260,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {row.description}
        </Box>
      ),
    },
  ];

  return (
    <ResponsiveDataTable<AuditLog>
      columns={columns}
      rows={data}
      rowKey={(row) => row.id}
      loading={loading}
      emptyText={tableEmptyText(error ?? null, t("audit.empty"))}
      sortState={onSortChange ? sortState : undefined}
      onSortChange={onSortChange ? handleSortChange : undefined}
      onRowClick={onView}
      renderRowActions={
        onView
          ? (row) => (
              <ActionButton
                kind="view"
                sx={{ whiteSpace: "nowrap" }}
                aria-label={t("audit.rowDetailAria")}
                onClick={() => onView(row)}
              >
                Xem
              </ActionButton>
            )
          : undefined
      }
    />
  );
}
