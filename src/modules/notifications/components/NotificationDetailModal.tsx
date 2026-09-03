import { useNavigate } from "react-router-dom";
import {
  Box,
  UiDescriptions,
  UiDialog,
  UiStatusBadge,
  type UiDescriptionsItem,
  SEMANTIC_LIGHT as S,
  RADIUS,
  TYPOGRAPHY,
} from "@/shared/ui";
import { UserOutlined } from "@/shared/components/icons";
import { StatusTag } from "@/shared/components/data-display/StatusTag";
import { NOTIFICATION_SEVERITY_LABELS } from "@/shared/constants/business-labels";
import {
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_PAYLOAD_FIELD_LABELS,
  NOTIFICATION_SEVERITY_COLOR,
  NOTIFICATION_SOURCE_MODULE_LABELS,
  NOTIFICATION_SUBJECT_TYPE_LABELS,
} from "@/modules/notifications/constants/notification.constants";
import { resolveNotificationLink } from "@/modules/notifications/utils/resolve-notification-link";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";
import { formatDateTime } from "@/shared/utils/format-date";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { ActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";

interface NotificationDetailModalProps {
  item: NotificationItem | null;
  onClose: () => void;
  /** Gọi trước khi điều hướng — vd để đóng dropdown chuông thông báo. */
  onNavigate?: () => void;
}

/** Giá trị payload có thể là chuỗi/số/bool/null hoặc object lồng — in JSON gọn cho trường hợp lồng. */
function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY_TEXT;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Modal chi tiết 1 thông báo — mở khi người dùng click vào 1 item trong
 * NotificationBell hoặc NotificationsPage. Hiển thị đầy đủ: ai thực hiện hành
 * động (actor_name), đối tượng nghiệp vụ liên quan, và toàn bộ payload kỹ
 * thuật đã được dịch sang nhãn tiếng Việt (NOTIFICATION_PAYLOAD_FIELD_LABELS).
 */
export function NotificationDetailModal({
  item,
  onClose,
  onNavigate,
}: NotificationDetailModalProps) {
  const t = useT();
  const navigate = useNavigate();
  const payloadEntries = Object.entries(item?.payload ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  const link = item ? resolveNotificationLink(item) : null;

  const handleViewDetail = () => {
    if (!link) return;
    onNavigate?.();
    onClose();
    navigate(link.path);
  };

  const eventLabelKey = item
    ? NOTIFICATION_EVENT_LABELS[item.event_key]
    : undefined;
  const sourceLabelKey = item
    ? NOTIFICATION_SOURCE_MODULE_LABELS[item.source_module]
    : undefined;
  const subjectLabelKey = item?.subject_type
    ? NOTIFICATION_SUBJECT_TYPE_LABELS[item.subject_type]
    : undefined;

  const detailItems: UiDescriptionsItem[] = item
    ? [
        {
          label: t("notifications.detail.fieldActor"),
          value: item.actor_name ? (
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
              }}
            >
              <UserOutlined />
              {item.actor_name}
            </Box>
          ) : (
            <Box component="span" sx={{ color: S.textMedium }}>
              {t("notifications.detail.actorSystem")}
            </Box>
          ),
        },
        {
          label: t("notifications.detail.fieldEvent"),
          value: eventLabelKey ? t(eventLabelKey) : item.event_key,
        },
        {
          label: t("notifications.detail.fieldSource"),
          value: sourceLabelKey ? t(sourceLabelKey) : item.source_module,
        },
        ...(item.subject_type
          ? [
              {
                label: t("notifications.detail.fieldSubject"),
                value: (
                  <>
                    {subjectLabelKey ? t(subjectLabelKey) : item.subject_type}
                    {/* Thông báo chưa kèm mã nghiệp vụ của đối tượng (BE mới
                      trả subject_type + subject_id) — rút gọn + cho sao chép
                      thay vì in nguyên UUID. Khi BE bổ sung subject_code thì
                      đổi sang hiện thẳng mã đó. */}
                    {item.subject_id ? (
                      <Box sx={{ mt: "2px" }}>
                        <CopyableId value={item.subject_id} />
                      </Box>
                    ) : null}
                  </>
                ),
              } satisfies UiDescriptionsItem,
            ]
          : []),
        {
          label: t("notifications.detail.fieldCreatedAt"),
          value: formatDateTime(item.created_at),
        },
        {
          label: t("notifications.detail.fieldReadStatus"),
          value: item.read_at ? (
            <UiStatusBadge
              tone="neutral"
              label={t("notifications.detail.readAt", {
                time: formatDateTime(item.read_at),
              })}
            />
          ) : (
            <UiStatusBadge
              tone="info"
              label={t("notifications.detail.unread")}
            />
          ),
        },
      ]
    : [];

  return (
    <UiDialog
      open={item !== null}
      onClose={onClose}
      maxWidth="md"
      title={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span>{t("notifications.detail.title")}</span>
          {item && (
            <StatusTag
              status={item.severity}
              colorMap={NOTIFICATION_SEVERITY_COLOR}
              labelMap={NOTIFICATION_SEVERITY_LABELS}
            />
          )}
        </Box>
      }
      actions={
        <>
          <ActionButton kind="close" onClick={onClose}>
            {t("common.close")}
          </ActionButton>
          {link && (
            <ActionButton kind="view" onClick={handleViewDetail}>
              {link.label}
            </ActionButton>
          )}
        </>
      }
    >
      {item && (
        <>
          <Box
            component="h3"
            sx={{
              m: 0,
              mb: 0.5,
              fontSize: TYPOGRAPHY.cardTitle.fontSize,
              fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
              lineHeight: TYPOGRAPHY.cardTitle.lineHeight,
              color: S.textHigh,
            }}
          >
            {item.title}
          </Box>
          <Box component="p" sx={{ m: 0, mb: 2, color: S.textMedium }}>
            {item.body}
          </Box>

          <Box
            sx={{
              border: `1px solid ${S.border}`,
              borderRadius: `${RADIUS.card}px`,
              p: 2,
            }}
          >
            <UiDescriptions items={detailItems} columns={2} />
          </Box>

          {payloadEntries.length > 0 && (
            <Box
              sx={{
                maxHeight: 240,
                overflowY: "auto",
                mt: 1.5,
                border: `1px solid ${S.border}`,
                borderRadius: `${RADIUS.card}px`,
                p: 2,
              }}
            >
              <UiDescriptions
                columns={2}
                items={payloadEntries.map(([key, value]) => {
                  const fieldKey = NOTIFICATION_PAYLOAD_FIELD_LABELS[key];
                  return {
                    label: fieldKey ? t(fieldKey) : key,
                    value: formatPayloadValue(value),
                  };
                })}
              />
            </Box>
          )}
        </>
      )}
    </UiDialog>
  );
}
