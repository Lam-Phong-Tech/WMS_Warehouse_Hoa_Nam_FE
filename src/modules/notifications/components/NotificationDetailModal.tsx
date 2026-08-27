import { Descriptions, Modal, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
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
import { ActionButton } from "@/shared/components/actions";

interface NotificationDetailModalProps {
  item: NotificationItem | null;
  onClose: () => void;
  /** Gọi trước khi điều hướng — vd để đóng dropdown chuông thông báo. */
  onNavigate?: () => void;
}

/** Giá trị payload có thể là chuỗi/số/bool/null hoặc object lồng — in JSON gọn cho trường hợp lồng. */
function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
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

  return (
    <Modal
      open={item !== null}
      onCancel={onClose}
      footer={
        <>
          <ActionButton kind="close" onClick={onClose}>
            Đóng
          </ActionButton>
          {link && (
            <ActionButton kind="view" onClick={handleViewDetail}>
              {link.label}
            </ActionButton>
          )}
        </>
      }
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Chi tiết thông báo</span>
          {item && (
            <StatusTag
              status={item.severity}
              colorMap={NOTIFICATION_SEVERITY_COLOR}
              labelMap={NOTIFICATION_SEVERITY_LABELS}
            />
          )}
        </div>
      }
      width={720}
    >
      {item && (
        <>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {item.title}
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            {item.body}
          </Typography.Paragraph>

          <Descriptions
            bordered
            size="small"
            column={{ xs: 1, sm: 2 }}
            styles={{ label: { width: 160 } }}
          >
            <Descriptions.Item label="Người thực hiện">
              {item.actor_name ? (
                <span>
                  <UserOutlined style={{ marginInlineEnd: 6 }} />
                  {item.actor_name}
                </span>
              ) : (
                <Typography.Text type="secondary">Hệ thống</Typography.Text>
              )}
            </Descriptions.Item>

            <Descriptions.Item label="Loại thông báo">
              {NOTIFICATION_EVENT_LABELS[item.event_key] ?? item.event_key}
            </Descriptions.Item>

            <Descriptions.Item label="Nguồn">
              {NOTIFICATION_SOURCE_MODULE_LABELS[item.source_module] ??
                item.source_module}
            </Descriptions.Item>

            {item.subject_type && (
              <Descriptions.Item label="Đối tượng liên quan">
                {NOTIFICATION_SUBJECT_TYPE_LABELS[item.subject_type] ??
                  item.subject_type}
                {item.subject_id && (
                  <Typography.Text
                    type="secondary"
                    copyable={{ text: item.subject_id }}
                    style={{ display: "block", fontSize: 12, marginTop: 2 }}
                  >
                    {item.subject_id}
                  </Typography.Text>
                )}
              </Descriptions.Item>
            )}

            <Descriptions.Item label="Thời gian tạo">
              {formatDateTime(item.created_at)}
            </Descriptions.Item>

            <Descriptions.Item label="Trạng thái đọc">
              {item.read_at ? (
                <Tag color="default">
                  Đã đọc lúc {formatDateTime(item.read_at)}
                </Tag>
              ) : (
                <Tag color="blue">Chưa đọc</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>

          {payloadEntries.length > 0 && (
            <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 12 }}>
              <Descriptions
                bordered
                size="small"
                column={{ xs: 1, sm: 2 }}
                styles={{ label: { width: 160 } }}
              >
                {payloadEntries.map(([key, value]) => (
                  <Descriptions.Item
                    key={key}
                    label={NOTIFICATION_PAYLOAD_FIELD_LABELS[key] ?? key}
                  >
                    {formatPayloadValue(value)}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
