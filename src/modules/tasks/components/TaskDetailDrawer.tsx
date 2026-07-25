import { useState } from 'react';
import {
  Descriptions,
  Tag,
  Button,
  Space,
  Divider,
  Tabs,
  Modal,
  Input,
  Timeline,
  Empty,
  Alert,
  Spin,
} from 'antd';
import { EditOutlined, HistoryOutlined } from '@ant-design/icons';
import { DetailDrawer } from '@/shared/components';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import type { Task, TaskHistoryEntry } from '../services/tasks.service';
import { useCancelTask, useTaskHistory } from '@/modules/tasks/hooks/use-tasks';
import { getMutationErrorMessage } from '@/shared/api/api-error';

const { TextArea } = Input;

interface TaskDetailDrawerProps {
  open: boolean;
  task: Task | null;
  loading?: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

const getPriorityTag = (priority: string) => {
  const map: Record<string, { color: string; text: string }> = {
    P0: { color: 'red', text: 'Khẩn cấp (P0)' },
    P1: { color: 'orange', text: 'Cao (P1)' },
    P2: { color: 'default', text: 'Trung bình (P2)' },
    high: { color: 'red', text: 'Cao' },
    medium: { color: 'orange', text: 'Trung bình' },
    low: { color: 'default', text: 'Thấp' },
  };
  const p = map[priority] || { color: 'default', text: priority };
  return <Tag color={p.color}>{p.text}</Tag>;
};

const getStatusTag = (status: string, isOverdue?: boolean) => {
  const map: Record<string, { color: string; text: string }> = {
    new: { color: 'default', text: 'Mới tạo' },
    assigned: { color: 'processing', text: 'Đã giao' },
    processing: { color: 'blue', text: 'Đang xử lý' },
    pending_approval: { color: 'warning', text: 'Chờ duyệt' },
    completed: { color: 'success', text: 'Hoàn thành' },
    rejected: { color: 'error', text: 'Từ chối' },
    cancel: { color: 'default', text: 'Đã hủy' },
    overdue: { color: 'error', text: 'Quá hạn' },
  };
  // Quá hạn là trạng thái hiển thị (theo wireframe P0 section I)
  if (isOverdue && status !== 'completed' && status !== 'cancel') {
    return <Tag color="error">⏱ Quá hạn</Tag>;
  }
  const s = map[status] || { color: 'default', text: status };
  return <Tag color={s.color}>{s.text}</Tag>;
};

const getTypeLabel = (type?: string) => {
  if (type === 'coordination') return 'Yêu cầu phối hợp';
  return 'Công việc thường';
};

export function TaskDetailDrawer({
  open,
  task,
  loading,
  onClose,
  onEdit,
}: TaskDetailDrawerProps) {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const cancelTaskMutation = useCancelTask();

  // Hook lấy lịch sử trạng thái — chỉ gọi khi drawer mở và có task
  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError,
  } = useTaskHistory(open && task ? task.id : null);

  const handleCancel = () => {
    if (!task) return;
    cancelTaskMutation.mutate(
      { id: task.id, note: cancelReason || undefined },
      {
        onSuccess: () => {
          toast.success('Đã hủy công việc');
          setCancelModalOpen(false);
          setCancelReason('');
          // Đóng drawer thay vì để mở với `task` prop cũ (chưa cập nhật
          // status → cancel) — tránh hiển thị nhầm trạng thái đã hết hạn.
          // Danh sách phía sau tự refetch qua invalidateQueries trong
          // useCancelTask.
          onClose();
        },
        onError: (err) => toast.error(getMutationErrorMessage(err)),
      },
    );
  };

  // Map status → màu timeline
  const getTimelineColor = (status: string) => {
    const colorMap: Record<string, string> = {
      new: 'gray',
      assigned: 'blue',
      processing: 'orange',
      pending_approval: 'gold',
      completed: 'green',
      rejected: 'red',
      cancel: 'gray',
    };
    return colorMap[status] || 'gray';
  };

  // Map status → nhãn hiển thị
  const getStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      new: 'Mới tạo',
      assigned: 'Đã giao',
      processing: 'Đang xử lý',
      pending_approval: 'Chờ duyệt',
      completed: 'Hoàn thành',
      rejected: 'Từ chối',
      cancel: 'Đã hủy',
    };
    return labelMap[status] || status;
  };

  const tabItems = task
    ? [
        {
          key: 'info',
          label: 'Thông tin',
          children: (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Mã công việc">
                <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                  {task.code}
                </span>
              </Descriptions.Item>

              <Descriptions.Item label="Loại công việc">
                {getTypeLabel(task.type)}
                {task.type === 'coordination' && (
                  <Tag color="purple" style={{ marginLeft: 6, fontSize: 11 }}>
                    Phối hợp
                  </Tag>
                )}
              </Descriptions.Item>

              <Descriptions.Item label="Tiêu đề">
                <div style={{ fontWeight: 600 }}>{task.title}</div>
              </Descriptions.Item>

              {task.description && (
                <Descriptions.Item label="Mô tả">
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {task.description}
                  </div>
                </Descriptions.Item>
              )}

              <Descriptions.Item label="Trạng thái">
                {getStatusTag(task.status, task.is_overdue)}
              </Descriptions.Item>

              <Descriptions.Item label="Mức ưu tiên">
                {getPriorityTag(task.priority)}
              </Descriptions.Item>

              <Divider style={{ margin: '12px 0' }} />

              <Descriptions.Item label="Người giao">
                {task.creator_name || `User #${task.creator_id}`}
              </Descriptions.Item>

              <Descriptions.Item label="Người thực hiện">
                {task.assignee_name ||
                  (task.assignee_id
                    ? `NV #${task.assignee_id}`
                    : 'Chưa chỉ định')}
              </Descriptions.Item>

              {task.approver_id && (
                <Descriptions.Item label="Người duyệt chỉ định">
                  {task.approver_name || `NV #${task.approver_id}`}
                </Descriptions.Item>
              )}

              <Divider style={{ margin: '12px 0' }} />

              {task.assignee_dept_id && (
                <Descriptions.Item label="Phòng ban nhận">
                  {task.assignee_dept_name || `Dept #${task.assignee_dept_id}`}
                </Descriptions.Item>
              )}

              <Descriptions.Item label="Hạn hoàn thành">
                {dayjs(task.due_date).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>

              {task.actual_done_date && (
                <Descriptions.Item label="Hoàn thành thực tế">
                  {dayjs(task.actual_done_date).format('DD/MM/YYYY HH:mm')}
                </Descriptions.Item>
              )}

              {task.result_file_url && (
                <Descriptions.Item label="Tệp kết quả đính kèm">
                  <a
                    href={task.result_file_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {task.result_file_url}
                  </a>
                </Descriptions.Item>
              )}

              {task.reject_reason && (
                <Descriptions.Item label="Lý do từ chối">
                  <div
                    style={{
                      color: '#a5413f',
                      background: '#fbe7e6',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                  >
                    {task.reject_reason}
                  </div>
                </Descriptions.Item>
              )}

              <Divider style={{ margin: '12px 0' }} />

              <Descriptions.Item label="Ngày tạo">
                {dayjs(task.created_at).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>

              <Descriptions.Item label="Cập nhật lần cuối">
                {dayjs(task.updated_at).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>
            </Descriptions>
          ),
        },
        {
          key: 'history',
          label: (
            <span>
              <HistoryOutlined style={{ marginRight: 4 }} />
              Lịch sử
            </span>
          ),
          children: (
            <div style={{ minHeight: 100 }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Spin tip="Đang tải lịch sử..." />
                </div>
              ) : historyError ? (
                <Alert
                  type="error"
                  showIcon
                  message="Không tải được lịch sử"
                  description={
                    <>
                      API lịch sử chưa khả dụng. Chi tiết:{' '}
                      {historyError.message || 'Lỗi không xác định'}
                    </>
                  }
                />
              ) : !historyData || historyData.length === 0 ? (
                <Empty
                  description="Chưa có lịch sử thay đổi trạng thái"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Timeline
                  items={historyData.map(
                    (entry: TaskHistoryEntry, idx: number) => ({
                      color: getTimelineColor(entry.to_status),
                      children: (
                        <div key={entry.id || idx}>
                          <div style={{ fontWeight: 500 }}>
                            {getStatusLabel(entry.to_status)}
                          </div>
                          <div style={{ fontSize: 12, color: '#8c887e' }}>
                            {entry.created_by_name ||
                              entry.actor?.full_name ||
                              'Hệ thống'}{' '}
                            ·{' '}
                            {dayjs(entry.created_at).format('DD/MM/YYYY HH:mm')}
                          </div>
                          {entry.note && (
                            <div
                              style={{
                                fontSize: 12,
                                color: '#595959',
                                marginTop: 2,
                                fontStyle: 'italic',
                              }}
                            >
                              "{entry.note}"
                            </div>
                          )}
                        </div>
                      ),
                    }),
                  )}
                />
              )}
            </div>
          ),
        },
      ]
    : [];

  return (
    <>
      <DetailDrawer
        title="Chi tiết công việc"
        open={open}
        onClose={onClose}
        width={520}
        loading={loading}
        extra={
          task && (
            <Space>
              {onEdit && (
                <Button icon={<EditOutlined />} onClick={onEdit}>
                  Sửa
                </Button>
              )}
              {/* Cancel button - chỉ hiện nếu user có quyền hủy (role có quyền, task chưa kết thúc) */}
            </Space>
          )
        }
      >
        {task && <Tabs items={tabItems} />}
      </DetailDrawer>

      {/* Cancel confirmation modal */}
      <Modal
        title="Hủy công việc"
        open={cancelModalOpen}
        onCancel={() => {
          setCancelModalOpen(false);
          setCancelReason('');
        }}
        onOk={handleCancel}
        okText="Xác nhận hủy"
        okButtonProps={{ danger: true, loading: cancelTaskMutation.isPending }}
        cancelText="Đóng"
      >
        <div style={{ marginBottom: 12 }}>
          Bạn có chắc muốn hủy công việc <strong>{task?.code}</strong>?
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
          Lý do hủy (không bắt buộc):
        </div>
        <TextArea
          rows={3}
          placeholder="Nhập lý do hủy (nếu có)..."
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </Modal>
    </>
  );
}
