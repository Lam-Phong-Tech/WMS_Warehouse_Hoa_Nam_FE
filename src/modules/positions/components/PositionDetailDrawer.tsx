import { Descriptions } from 'antd';
import { StatusBadge, DetailDrawer } from '@/shared/components';
import { formatDate } from '@/shared/utils/format-date';
import type { Position } from '@/modules/positions/types/positions.types';

interface PositionDetailDrawerProps {
  open: boolean;
  position: Position | null;
  loading?: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function PositionDetailDrawer({
  open,
  position,
  loading,
  onClose,
}: PositionDetailDrawerProps) {
  return (
    <DetailDrawer
      title="Chi tiết chức vụ"
      open={open}
      onClose={onClose}
      width={420}
      loading={loading}
    >
      {position && (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Mã chức vụ">
            {position.code}
          </Descriptions.Item>
          <Descriptions.Item label="Tên chức danh">
            {position.name}
          </Descriptions.Item>
          <Descriptions.Item label="Cấp bậc">
            {position.grade || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Mô tả">
            {position.description || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Số nhân sự đang giữ">
            {position.employeeCount ?? 0}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <StatusBadge active={position.active} inactiveLabel="Vô hiệu" />
          </Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">
            {position.created_at ? formatDate(position.created_at) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Cập nhật lần cuối">
            {position.updated_at ? formatDate(position.updated_at) : '—'}
          </Descriptions.Item>
        </Descriptions>
      )}
    </DetailDrawer>
  );
}
