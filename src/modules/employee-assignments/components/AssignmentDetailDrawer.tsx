import { Descriptions, Tag } from 'antd';
import { DetailDrawer } from '@/shared/components';
import dayjs from 'dayjs';
import { formatDate } from '@/shared/utils/format-date';
import type { EmployeeAssignment } from '../hooks/use-employee-assignments';

interface AssignmentDetailDrawerProps {
  open: boolean;
  assignment: EmployeeAssignment | null;
  loading?: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function AssignmentDetailDrawer({
  open,
  assignment,
  loading,
  onClose,
}: AssignmentDetailDrawerProps) {
  return (
    <DetailDrawer
      title="Chi tiết phân công nhân sự"
      open={open}
      onClose={onClose}
      width={480}
      loading={loading}
    >
      {assignment && (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Nhân sự">
            {assignment.employee
              ? `${assignment.employee.full_name} (${assignment.employee.code})`
              : `ID: ${assignment.employee_id}`}
          </Descriptions.Item>
          <Descriptions.Item label="Đơn vị">
            {assignment.org_unit?.name ?? `ID: ${assignment.org_unit_id}`}
          </Descriptions.Item>
          <Descriptions.Item label="Phòng ban">
            {assignment.department?.name ?? `ID: ${assignment.department_id}`}
          </Descriptions.Item>
          <Descriptions.Item label="Chức vụ">
            {assignment.position?.name ?? `ID: ${assignment.position_id}`}
          </Descriptions.Item>
          <Descriptions.Item label="Phân công chính">
            {assignment.is_primary ? 'Có' : 'Không'}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày bắt đầu">
            {assignment.start_date
              ? dayjs(assignment.start_date).format('DD/MM/YYYY')
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày kết thúc">
            {assignment.end_date
              ? dayjs(assignment.end_date).format('DD/MM/YYYY')
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={assignment.status ? 'success' : 'default'}>
              {assignment.status ? 'Đang hiệu lực' : 'Ngưng hiệu lực'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Đang áp dụng">
            {assignment.is_current ? (
              <Tag color="blue">Bản ghi hiện hành</Tag>
            ) : (
              '—'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">
            {assignment.created_at ? formatDate(assignment.created_at) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Cập nhật lần cuối">
            {assignment.updated_at ? formatDate(assignment.updated_at) : '—'}
          </Descriptions.Item>
        </Descriptions>
      )}
    </DetailDrawer>
  );
}
