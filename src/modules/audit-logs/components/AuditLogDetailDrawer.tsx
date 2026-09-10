import { useT } from "@/shared/i18n/useT";
import { type ReactNode } from "react";
import {
  Box,
  Grid,
  Stack,
  UiDialog,
  UiStatusBadge,
  SEMANTIC_LIGHT as S,
  RADIUS,
  TYPOGRAPHY,
} from "@/shared/ui";
import { toast } from "sonner";
import type { AuditLog } from "../types/audit-logs.types";
import { formatDateTime } from "@/shared/utils/format-date";
import { AUDIT_MODULE_LABELS } from "@/shared/constants/business-labels";
import {
  auditActionLabel,
  auditActionTone,
  auditDataEntries,
  auditObjectCode,
  auditObjectTypeLabel,
  describeAuditLog,
} from "../constants/audit-log-labels";
import { ActionIconButton } from "@/shared/components/actions";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { EMPTY_TEXT } from "@/shared/constants/display";

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

/**
 * Khối "Dữ liệu trước/sau thay đổi".
 *
 * Trước đây in thẳng `JSON.stringify` — người dùng đọc được đúng dấu ngoặc và
 * `{"status": "SCANNING"}`. Nay CHỈ còn danh sách "tên trường – giá trị"
 * tiếng Việt (xem `auditDataEntries`): UAT TC_UI_13 yêu cầu tuyệt đối không
 * hiển thị JSON ở màn nghiệp vụ, nên nút "Xem dữ liệu gốc" đã bị gỡ hẳn —
 * quản trị cần đối chiếu thô thì tra thẳng bản ghi audit_logs phía BE.
 */
function AuditDataBlock({ title, data }: { title: string; data: unknown }) {
  const entries = auditDataEntries(data as Record<string, unknown> | null);
  if (entries.length === 0) return null;

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
        sx={{
          bgcolor: S.bgSubtle,
          border: `1px solid ${S.border}`,
          borderRadius: `${RADIUS.card}px`,
          p: 2,
        }}
      >
        <Grid container spacing={1.5}>
          {entries.map((entry) => (
            <Grid key={entry.key} size={{ xs: 12, sm: 6 }}>
              <Box sx={{ fontSize: 12, color: S.textMedium }}>
                {entry.label}
              </Box>
              <Box
                sx={{
                  fontSize: TYPOGRAPHY.fontSizeSecondary,
                  color: S.textHigh,
                  overflowWrap: "anywhere",
                }}
              >
                {entry.value}
              </Box>
            </Grid>
          ))}
        </Grid>
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

  const objectCode = auditObjectCode(auditLog);

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
                  tone={auditActionTone(auditLog.action)}
                  label={auditActionLabel(auditLog.action)}
                />
              }
            />
            <DetailField
              label={t("audit.colModule")}
              value={
                AUDIT_MODULE_LABELS[auditLog.module] || t("audit.moduleOther")
              }
            />
            {/* `object_type` là tên bảng/slug route của BE — hiện nhãn tiếng
              Việt của loại đối tượng kèm MÃ NGHIỆP VỤ (số phiếu, mã hồ sơ,
              serial...) do BE tra ngược. Chỉ loại đối tượng không có mã, hoặc
              bản ghi gốc không còn, mới rơi về định danh rút gọn có nút sao
              chép. Giá trị kỹ thuật của loại đối tượng giữ ở tooltip. */}
            <DetailField
              label={t("audit.colObject")}
              value={
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: "center", flexWrap: "wrap" }}
                >
                  <Box
                    component="span"
                    title={auditLog.object_type || undefined}
                  >
                    {auditLog.object_type
                      ? auditObjectTypeLabel(auditLog.object_type)
                      : EMPTY_TEXT}
                  </Box>
                  {objectCode ? (
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      {objectCode}
                    </Box>
                  ) : auditLog.object_id ? (
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
            {/* Không in `auditLog.description` của BE: đó là chuỗi ghép máy
              `"{ACTION} {object_type} #{uuid}"`. Dựng câu tiếng Việt từ cùng
              nguyên liệu (kèm số chứng từ nếu có). */}
            <DetailField
              label={t("audit.colDescription")}
              value={describeAuditLog(auditLog)}
            />
          </Grid>
        </Box>

        <AuditDataBlock
          title={t("audit.beforeData")}
          data={auditLog.before_data}
        />
        {/* `after_data` là phần giàu thông tin nhất (số chứng từ, mục đích,
          ảnh hưởng tồn...) nhưng trước đây không hiện ra màn nào. */}
        <AuditDataBlock
          title={t("audit.afterData")}
          data={auditLog.after_data}
        />
      </Stack>
    </UiDialog>
  );
}
