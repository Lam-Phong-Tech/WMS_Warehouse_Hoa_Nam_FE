import type { ReactNode } from "react";
import { Tag, Typography as AntTypography } from "antd";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { toast } from "sonner";
import type { AuditLog } from "../types/audit-logs.types";
import { formatDateTime } from "@/shared/utils/format-date";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_MODULE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { ActionIconButton } from "@/shared/components/actions";

const { Text } = AntTypography;

const ACTION_COLOR: Record<string, string> = {
  CREATE: "green",
  UPDATE: "blue",
  DELETE: "red",
  REVOKE_ROLE_SCOPE: "orange",
  SYNC_ROLE_SCOPES: "purple",
  SUBMIT: "cyan",
  CANCEL: "magenta",
  ARCHIVE: "gray",
  RESTORE: "lime",
};

/** Cặp nhãn/giá trị trong Dialog "Chi tiết nhật ký hệ thống" (thay antd Descriptions.Item). */
function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </Grid>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      <Box
        component="pre"
        sx={{
          bgcolor: "action.hover",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
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

  const copyId = () => {
    void navigator.clipboard?.writeText(auditLog.id);
    toast.success("Đã sao chép mã bản ghi.");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6, position: "relative" }}>
        Chi tiết nhật ký hệ thống
        <ActionIconButton
          kind="close"
          label="Đóng"
          onClick={onClose}
          sx={{ position: "absolute", right: 10, top: 8 }}
        />
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: 2,
            }}
          >
            <Grid container spacing={2}>
              <DetailField
                label="Mã bản ghi"
                value={
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ alignItems: "center" }}
                  >
                    <span>{auditLog.id}</span>
                    <ActionIconButton
                      kind="copy"
                      label="Sao chép mã bản ghi"
                      onClick={copyId}
                    />
                  </Stack>
                }
              />
              <DetailField
                label="Thời gian"
                value={formatDateTime(auditLog.created_at)}
              />
              <DetailField
                label="Hành động"
                value={
                  <Tag color={ACTION_COLOR[auditLog.action] ?? "default"}>
                    {actionLabel}
                  </Tag>
                }
              />
              <DetailField
                label="Phân hệ"
                value={AUDIT_MODULE_LABELS[auditLog.module] || "Phân hệ khác"}
              />
              <DetailField
                label="Đối tượng"
                value={`${auditLog.object_type}${auditLog.object_id ? ` #${auditLog.object_id}` : ""}`}
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
                  <Text copyable={!!auditLog.ip_address}>
                    {auditLog.ip_address || "—"}
                  </Text>
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
      </DialogContent>
    </Dialog>
  );
}
