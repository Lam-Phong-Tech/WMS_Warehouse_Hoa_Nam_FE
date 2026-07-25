import dayjs from 'dayjs';
import { Descriptions, Empty, Tag } from 'antd';
import { DetailDrawer } from '@/shared/components';
import {
  EmployeeStatus,
  EMPLOYEE_STATUS_LABELS,
} from '@/modules/employees/types/employees.types';
import { useStatusHistoryDetail } from '@/modules/employee-status/hooks/use-employee-status';

interface Props {
  open: boolean;
  /** ID bản ghi lịch sử trạng thái — nếu falsy thì drawer rỗng. */
  recordId: number | null;
  onClose: () => void;
}

/**
 * Map trạng thái số → màu Tag (dùng lại từ EmployeeStatusPage).
 */
const STATUS_BADGE: Record<EmployeeStatus, { color: string; icon: string }> = {
  [EmployeeStatus.INTERN]: { color: 'processing', icon: '◔' },
  [EmployeeStatus.PROBATION]: { color: 'blue', icon: '◔' },
  [EmployeeStatus.OFFICIAL]: { color: 'success', icon: '●' },
  [EmployeeStatus.SUSPENDED]: { color: 'warning', icon: '◐' },
  [EmployeeStatus.RESIGNED]: { color: 'error', icon: '✕' },
  [EmployeeStatus.ARCHIVED]: { color: 'default', icon: '📦' },
};

function StatusTag({ status }: { status: EmployeeStatus | null | undefined }) {
  if (status == null) {
    return <Tag>— Mới tạo</Tag>;
  }
  const badge = STATUS_BADGE[status];
  return (
    <Tag color={badge?.color}>
      {badge?.icon} {EMPLOYEE_STATUS_LABELS[status] ?? String(status)}
    </Tag>
  );
}

const dash = (v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : String(v);

/**
 * Drawer xem chi tiết một bản ghi lịch sử trạng thái nhân sự.
 * Gọi API GET /employee-status-histories/{id} để lấy dữ liệu đầy đủ (kèm employee).
 */
export function StatusHistoryDetailDrawer({ open, recordId, onClose }: Props) {
  const {
    data: record,
    isLoading,
    isError,
  } = useStatusHistoryDetail(open ? recordId : null);

  const employeeName =
    record?.employee?.fullName ??
    (record?.employee ? `ID: ${record.employee.id}` : '—');
  const employeeCode = record?.employee?.code ?? '—';

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      width={560}
      title="Chi tiết bản ghi lịch sử trạng thái"
      loading={isLoading}
    >
      {/* Lỗi / không tìm thấy */}
      {!isLoading && (isError || !record) ? (
        <Empty description="Không tìm thấy bản ghi hoặc có lỗi xảy ra." />
      ) : (
        record && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Nhân sự">
                <div style={{ fontWeight: 700 }}>{employeeName}</div>
                <div style={{ fontSize: 12, color: '#8c887e' }}>
                  {employeeCode}
                </div>
              </Descriptions.Item>

              <Descriptions.Item label="Trạng thái cũ">
                <StatusTag status={record.old_status} />
              </Descriptions.Item>

              <Descriptions.Item label="Trạng thái mới">
                <StatusTag status={record.new_status} />
              </Descriptions.Item>

              <Descriptions.Item label="Ngày hiệu lực">
                {record.effective_date
                  ? dayjs(record.effective_date).format('DD/MM/YYYY')
                  : '—'}
              </Descriptions.Item>

              <Descriptions.Item label="Lý do / Ghi chú">
                {dash(record.reason ?? record.note)}
              </Descriptions.Item>

              <Descriptions.Item label="Người tạo">
                <div>
                  {record.created_by_name ??
                    record.changed_by_user?.fullName ??
                    dash(record.created_by ?? record.changed_by)}
                </div>
                {record.created_by_email && (
                  <div style={{ fontSize: 12, color: '#8c887e' }}>
                    {record.created_by_email}
                  </div>
                )}
              </Descriptions.Item>

              <Descriptions.Item label="Thời gian tạo">
                {record.created_at
                  ? new Date(record.created_at).toLocaleString('vi-VN')
                  : '—'}
              </Descriptions.Item>
            </Descriptions>

            {record.updated_by != null || record.updated_at != null ? (
              <Descriptions
                column={1}
                size="small"
                bordered
                style={{ marginTop: 16 }}
              >
                <Descriptions.Item label="Thời gian cập nhật">
                  {record.updated_at
                    ? new Date(record.updated_at).toLocaleString('vi-VN')
                    : '—'}
                </Descriptions.Item>
              </Descriptions>
            ) : null}
          </>
        )
      )}
    </DetailDrawer>
  );
}
