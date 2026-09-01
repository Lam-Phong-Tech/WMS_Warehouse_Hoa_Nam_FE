import { useT } from "@/shared/i18n/useT";
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
  const t = useT();
  // Giữ `auditLog` cho tới khi Dialog chạy xong hiệu ứng đóng là việc của màn
  // cha (AuditLogsPage tách riêng cờ `detailOpen` với bản ghi đang xem) — ở đây
  // trả null khi chưa có bản ghi thì `open` cũng đang false, không mất hiệu ứng.
  if (!auditLog) return null;

  const actionLabel = businessLabel(
    AUDIT_ACTION_LABELS,
    auditLog.action,
    t("audit.actionOther"),
  );

  // Thay Typography.Text copyable của antd: nút copy tường minh + toast.
  const copyIp = () => {
    if (!auditLog.ip_address) return;
    void navigator.clipboard?.writeText(auditLog.ip_address);
    toast.success(t("audit.ipCopied"));
  };

  return (
    <UiDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title={
        <Box sx={{ pr: 6, position: "relative" }}>
          {t("audit.detailTitle")}
          <ActionIconButton
            kind="close"
            label={t("common.close")}
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
              label={t("audit.fieldRecordId")}
              value={<CopyableId value={auditLog.id} />}
            />
            <DetailField
              label={t("audit.colTime")}
              value={formatDateTime(auditLog.created_at)}
            />
            <DetailField
              label={t("audit.colAction")}
              value={
                <UiStatusBadge
                  tone={ACTION_TONES[auditLog.action] ?? "neutral"}
                  label={actionLabel}
                />
              }
            />
            <DetailField
              label={t("audit.colModule")}
              value={
                AUDIT_MODULE_LABELS[auditLog.module] || t("audit.moduleOther")
              }
            />
            {/* BE chưa trả mã nghiệp vụ của đối tượng (chỉ có object_type +
              object_id) — hiện loại đối tượng kèm định danh rút gọn, không nối
              nguyên UUID vào câu. Khi BE bổ sung object_code thì hiện mã đó. */}
            <DetailField
              label={t("audit.colObject")}
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
              label={t("audit.colActor")}
              value={
                auditLog.actor?.email ||
                auditLog.actor?.display_name ||
                t("audit.system")
              }
            />
            <DetailField
              label={t("audit.colIp")}
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
                      label={t("audit.copyIpAria")}
                      onClick={copyIp}
                    />
                  </Stack>
                ) : (
                  EMPTY_TEXT
                )
              }
            />
            <DetailField
              label={t("audit.colDescription")}
              value={auditLog.description}
            />
          </Grid>
        </Box>

        {auditLog.before_data && (
          <JsonBlock
            title={t("audit.beforeData")}
            value={auditLog.before_data}
          />
        )}
      </Stack>
    </UiDialog>
  );
}
