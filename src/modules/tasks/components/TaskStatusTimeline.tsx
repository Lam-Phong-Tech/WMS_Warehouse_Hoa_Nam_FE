import { Timeline, Tag, Spin, Empty, Typography, Alert, Button } from 'antd';
import dayjs from 'dayjs';
import type { TaskHistoryEntry } from '@/modules/tasks/services/tasks.service';
import {
  getApiErrorMessage,
  isNoPermissionError,
} from '@/shared/api/api-error';

const { Text } = Typography;

/**
 * Map status từ BE sang nhãn hiển thị tiếng Việt (khớp wireframe P0 section A legend)
 */
const STATUS_LABELS: Record<string, string> = {
  new: 'Mới tạo',
  assigned: 'Đã giao',
  processing: 'Đang xử lý',
  pending_approval: 'Chờ duyệt',
  completed: 'Hoàn thành',
  rejected: 'Từ chối / Làm lại',
  cancel: 'Đã hủy',
  overdue: 'Quá hạn',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'gray',
  assigned: 'blue',
  processing: 'blue',
  pending_approval: 'orange',
  completed: 'green',
  rejected: 'red',
  cancel: 'gray',
  overdue: 'red',
};

interface TaskStatusTimelineProps {
  history: TaskHistoryEntry[] | undefined;
  loading?: boolean;
  /** Lỗi khi gọi API /histories — phân biệt với "chưa có dữ liệu" (P2.2). */
  error?: unknown;
  onRetry?: () => void;
}

export function TaskStatusTimeline({
  history,
  loading,
  error,
  onRetry,
}: TaskStatusTimelineProps) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <Spin tip="Đang tải lịch sử..." />
      </div>
    );
  }

  // P2.2: lỗi API phải hiển thị riêng, không được lẫn với "chưa có lịch sử"
  // — nếu không, người dùng dễ hiểu nhầm task chưa từng thay đổi trạng thái.
  if (error) {
    if (isNoPermissionError(error)) {
      return (
        <Alert
          type="warning"
          showIcon
          message="Bạn không có quyền xem lịch sử trạng thái của công việc này."
        />
      );
    }
    return (
      <Alert
        type="error"
        showIcon
        message="Không tải được lịch sử trạng thái"
        description={getApiErrorMessage(error)}
        action={
          onRetry ? (
            <Button size="small" danger onClick={onRetry}>
              Thử lại
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (!history || history.length === 0) {
    return (
      <Empty
        description="Chưa có lịch sử trạng thái"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  // Sắp xếp mới nhất lên đầu
  const sorted = [...history].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div style={{ padding: '0 4px' }}>
      <Timeline
        items={sorted.map((entry) => {
          const fromLabel = entry.from_status
            ? STATUS_LABELS[entry.from_status] || entry.from_status
            : null;
          const toLabel = STATUS_LABELS[entry.to_status] || entry.to_status;
          const color = STATUS_COLORS[entry.to_status] || 'gray';
          const actorName =
            entry.created_by_name ||
            entry.actor?.full_name ||
            entry.actor?.email ||
            'Hệ thống';
          const timeStr = dayjs(entry.created_at).format('DD/MM/YYYY HH:mm');

          return {
            color,
            children: (
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {fromLabel ? (
                    <>
                      <Tag
                        color={
                          STATUS_COLORS[entry.from_status || ''] || 'default'
                        }
                        style={{ fontSize: 11 }}
                      >
                        {fromLabel}
                      </Tag>
                      <span style={{ margin: '0 4px', color: '#999' }}>→</span>
                    </>
                  ) : null}
                  <Tag color={color} style={{ fontSize: 11 }}>
                    {toLabel}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  <Text type="secondary">{actorName}</Text>
                  <span style={{ margin: '0 6px' }}>·</span>
                  <Text type="secondary">{timeStr}</Text>
                </div>
                {entry.note && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: '#333',
                      background: '#f6f4ee',
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: '1px solid #e8e5dd',
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>{entry.note}</Text>
                  </div>
                )}
              </div>
            ),
          };
        })}
      />
    </div>
  );
}
