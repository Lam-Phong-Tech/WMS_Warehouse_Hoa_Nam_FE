import type { ReactNode } from "react";
import {
  Box,
  Grid,
  Stack,
  UiDialog,
  UiStatusBadge,
  type UiStatusTone,
  SEMANTIC_LIGHT as S,
  RADIUS,
  TYPOGRAPHY,
} from "@/shared/ui";
import { toast } from "sonner";
import type { AuditLog } from "../types/audit-logs.types";
import { formatDateTime } from "@/shared/utils/format-date";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_MODULE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { ActionIconButton } from "@/shared/components/actions";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { EMPTY_TEXT } from "@/shared/constants/display";

// Map preset màu antd Tag cũ → tone UiStatusBadge (cùng bảng với AuditLogsTable).
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

/** Cặp nhãn/giá trị trong Dialog "Chi tiết nhật ký hệ thống" (thay antd Descriptions.Item). */
function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Box sx={{ fontSize: 12, color: S.textMedium }}>{label}</Box>
      <Box
        sx={{
          fontSize: TYPOGRAPHY.fontSizeSecondary,
          color: S.textHigh,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </Box>
    </Grid>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <Box>
      <Box
        component="h3"
        sx={{
          m: 0,
          mb: 1,
          fontSize: TYPOGRAPHY.fontSizeBody,
          fontWeight: 700,
          color: S.textHigh,
        }}
      >
        {title}
      </Box>
      <Box
        component="pre"
        sx={{
          bgcolor: S.bgSubtle,
          border: `1px solid ${S.border}`,
          borderRadius: `${RADIUS.card}px`,
          p: 2,
          maxHeight: 300,
          overflow: "auto",
          fontSize: 12,
          m: 0,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Box>
    </Box>
  );
}

export interface AuditLogDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  auditLog: AuditLog | null;
}

export function AuditLogDetailDrawer({
  open,
  onClose,
  auditLog,
}: AuditLogDetailDrawerProps) {
  // Giữ `auditLog` cho tới khi Dialog chạy xong hiệu ứng đóng là việc của màn
  // cha (AuditLogsPage tách riêng cờ `detailOpen` với bản ghi đang xem) — ở đây
  // trả null khi chưa có bản ghi thì `open` cũng đang false, không mất hiệu ứng.
  if (!auditLog) return null;

  const actionLabel = businessLabel(
    AUDIT_ACTION_LABELS,
    auditLog.action,
    "Hành động khác",
  );

  // Thay Typography.Text copyable của antd: nút copy tường minh + toast.
  const copyIp = () => {
    if (!auditLog.ip_address) return;
    void navigator.clipboard?.writeText(auditLog.ip_address);
    toast.success("Đã sao chép địa chỉ IP.");
  };

  return (
    <UiDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title={
        <Box sx={{ pr: 6, position: "relative" }}>
          Chi tiết nhật ký hệ thống
          <ActionIconButton
            kind="close"
            label="Đóng"
            onClick={onClose}
            sx={{ position: "absolute", right: -10, top: -2 }}
          />
        </Box>
      }
    >
      <Stack spacing={2}>
        <Box
          sx={{
            border: `1px solid ${S.border}`,
            borderRadius: `${RADIUS.card}px`,
            p: 2,
          }}
        >
          <Grid container spacing={2}>
            {/* Bản ghi nhật ký không có mã nghiệp vụ (id là UUID) — rút gọn +
              cho sao chép thay vì in nguyên chuỗi thô. */}
            <DetailField
              label="Định danh bản ghi"
              value={<CopyableId value={auditLog.id} />}
            />
            <DetailField
              label="Thời gian"
              value={formatDateTime(auditLog.created_at)}
            />
            <DetailField
              label="Hành động"
              value={
                <UiStatusBadge
                  tone={ACTION_TONES[auditLog.action] ?? "neutral"}
                  label={actionLabel}
                />
              }
            />
            <DetailField
              label="Phân hệ"
              value={AUDIT_MODULE_LABELS[auditLog.module] || "Phân hệ khác"}
            />
            {/* BE chưa trả mã nghiệp vụ của đối tượng (chỉ có object_type +
              object_id) — hiện loại đối tượng kèm định danh rút gọn, không nối
              nguyên UUID vào câu. Khi BE bổ sung object_code thì hiện mã đó. */}
            <DetailField
              label="Đối tượng"
              value={
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: "center", flexWrap: "wrap" }}
                >
                  <span>{auditLog.object_type}</span>
                  {auditLog.object_id ? (
                    <CopyableId value={auditLog.object_id} />
                  ) : null}
                </Stack>
              }
            />
            <DetailField
              label="Người thực hiện"
              value={
                auditLog.actor?.email ||
                auditLog.actor?.display_name ||
                "Hệ thống"
              }
            />
            <DetailField
              label="Địa chỉ IP"
              value={
                auditLog.ip_address ? (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ alignItems: "center" }}
                  >
                    <span>{auditLog.ip_address}</span>
                    <ActionIconButton
                      kind="copy"
                      label="Sao chép địa chỉ IP"
                      onClick={copyIp}
                    />
                  </Stack>
                ) : (
                  EMPTY_TEXT
                )
              }
            />
            <DetailField label="Mô tả" value={auditLog.description} />
          </Grid>
        </Box>

        {auditLog.before_data && (
          <JsonBlock
            title="Dữ liệu trước thay đổi"
            value={auditLog.before_data}
          />
        )}
      </Stack>
    </UiDialog>
  );
}
