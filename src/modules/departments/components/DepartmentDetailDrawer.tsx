import { Avatar, Button, Descriptions, Space, Tag, Typography } from 'antd';
import {
  UndoOutlined,
  DeleteOutlined,
  UserOutlined,
  EditOutlined,
  ApartmentOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { StatusBadge, StatusTag, DetailDrawer } from '@/shared/components';
import { usePermission } from '@/shared/components/permission';
import { formatDate } from '@/shared/utils/format-date';
import {
  getPrimaryAssignment,
  type Employee,
} from '@/modules/employees/types/employees.types';
import {
  DEPARTMENT_STATUS_LABELS,
  getDepartmentStatus,
  type Department,
  type DepartmentType,
} from '@/modules/departments/types/departments.types';
import { ORG_UNIT_STATUS_COLORS } from '@/modules/org-units/types/org-units.types';

const { Text, Title } = Typography;

const DEPARTMENT_TYPE_LABELS: Record<DepartmentType, string> = {
  phong_ban: 'Phòng ban',
  nhom_to: 'Nhóm/Tổ',
};

/** Số nhân sự hiển thị tối đa trước khi rút gọn. */
const MAX_VISIBLE_MEMBERS = 4;

export interface DepartmentDetailDrawerProps {
  open: boolean;
  department: Department | null;
  loading?: boolean;
  /** Nhân sự thuộc phòng ban (đã lọc từ trang). */
  members: Employee[];
  onClose: () => void;
  onEdit: () => void;
  /** Vô hiệu hóa (active → inactive). */
  onDeactivate: () => void;
  /** Kích hoạt lại (inactive → active). */
  onActivate?: () => void;
  /** Xóa mềm (active/inactive → soft_deleted). */
  onSoftDelete?: () => void;
  /** Khôi phục (soft_deleted → active). */
  onRestore?: () => void;
  onAddMember?: () => void;
  /** Mở form thêm mới, prefill sẵn phòng ban cha = phòng ban đang xem. */
  onCreateSubgroup?: () => void;
}

function MemberRow({ employee }: { employee: Employee }) {
  const position = getPrimaryAssignment(employee)?.position?.name;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid #f5f5f5',
      }}
    >
      <Avatar icon={<UserOutlined />} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{employee.fullName}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {[position, employee.code].filter(Boolean).join(' · ') || '—'}
        </Text>
      </div>
      <StatusBadge
        active={employee.status === 1}
        activeLabel="Đang làm"
        inactiveLabel="Tạm ngưng"
      />
    </div>
  );
}

/** Drawer chi tiết phòng ban: thông tin + trưởng phòng + danh sách nhân sự + thao tác. */
export function DepartmentDetailDrawer({
  open,
  department,
  loading,
  members,
  onClose,
  onEdit,
  onDeactivate,
  onActivate,
  onSoftDelete,
  onRestore,
  onCreateSubgroup,
}: DepartmentDetailDrawerProps) {
  const { can: canEdit } = usePermission({
    module: 'departments',
    action: 'edit',
  });
  const { can: canDelete } = usePermission({
    module: 'departments',
    action: 'delete',
  });
  const { can: canCreate } = usePermission({
    module: 'departments',
    action: 'create',
  });

  const visible = members.slice(0, MAX_VISIBLE_MEMBERS);
  const hiddenCount = members.length - visible.length;

  const status = department ? getDepartmentStatus(department) : null;

  /** Render action buttons phù hợp theo trạng thái — đồng bộ logic với DepartmentsTable. */
  const actionExtra = (() => {
    if (!status || !department) return undefined;

    const buttons: React.ReactNode[] = [];

    // Active: Sửa, Tạo nhóm/tổ con, Ngừng hoạt động
    if (status === 'active') {
      if (canEdit) {
        buttons.push(
          <Button
            key="edit"
            size="small"
            icon={<EditOutlined />}
            onClick={onEdit}
          >
            Sửa
          </Button>,
        );
      }
      if (
        department.departmentType === 'phong_ban' &&
        canCreate &&
        onCreateSubgroup
      ) {
        buttons.push(
          <Button
            key="createSubgroup"
            size="small"
            icon={<ApartmentOutlined />}
            onClick={onCreateSubgroup}
          >
            Tạo nhóm/tổ con
          </Button>,
        );
      }
      if (canDelete) {
        buttons.push(
          <Button
            key="deactivate"
            size="small"
            danger
            icon={<StopOutlined />}
            onClick={onDeactivate}
          >
            Ngừng hoạt động
          </Button>,
        );
      }
    }

    // Inactive: Kích hoạt lại
    if (status === 'inactive' && canDelete) {
      buttons.push(
        <Button
          key="activate"
          size="small"
          icon={<UndoOutlined />}
          onClick={onActivate}
        >
          Kích hoạt lại
        </Button>,
      );
    }

    // Active/Inactive: Xóa (đồng bộ với DepartmentsTable — softDelete áp dụng cho cả 2 trạng thái)
    if ((status === 'active' || status === 'inactive') && canDelete) {
      buttons.push(
        <Button
          key="softDelete"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={onSoftDelete}
        >
          Xóa
        </Button>,
      );
    }

    // Soft-deleted: Khôi phục
    if (status === 'soft_deleted' && canDelete) {
      buttons.push(
        <Button
          key="restore"
          size="small"
          icon={<UndoOutlined />}
          onClick={onRestore}
        >
          Khôi phục
        </Button>,
      );
    }

    if (buttons.length === 0) return undefined;
    return <Space size="small">{buttons}</Space>;
  })();

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      width={420}
      loading={loading || !department}
      skeletonRows={6}
      extra={actionExtra}
    >
      {department && (
        <>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Title level={4} style={{ margin: 0 }}>
              {department.name}
            </Title>
            <StatusTag
              status={getDepartmentStatus(department)}
              colorMap={ORG_UNIT_STATUS_COLORS}
              labelMap={DEPARTMENT_STATUS_LABELS}
            />
          </div>

          <Descriptions
            column={1}
            bordered
            size="small"
            style={{ marginTop: 12 }}
          >
            <Descriptions.Item label="Mã phòng ban">
              {department.code}
            </Descriptions.Item>
            <Descriptions.Item label="Tên phòng ban">
              {department.name}
            </Descriptions.Item>
            <Descriptions.Item label="Loại">
              {DEPARTMENT_TYPE_LABELS[department.departmentType]}
            </Descriptions.Item>
            <Descriptions.Item label="Đơn vị trực thuộc">
              {department.orgUnitName || '—'}
            </Descriptions.Item>
            {department.parentId && (
              <Descriptions.Item label="Phòng ban cha">
                {department.parentName || '—'}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Số nhân sự">
              {department.employeeCount ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">
              {department.createdAt ? formatDate(department.createdAt) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Cập nhật lần cuối">
              {department.updatedAt ? formatDate(department.updatedAt) : '—'}
            </Descriptions.Item>
          </Descriptions>

          {/* Trưởng phòng */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 16,
              padding: '10px 12px',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
            }}
          >
            <Avatar icon={<UserOutlined />} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text strong>
                {department.managerName ?? 'Chưa có trưởng phòng'}
              </Text>
              {department.managerName && (
                <Text type="secondary"> · Trưởng phòng</Text>
              )}
            </div>
            {department.managerName && (
              <Tag color="blue">Người duyệt mặc định</Tag>
            )}
          </div>

          {/* Mô tả */}
          {department.note && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 12px',
                background: '#fafafa',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
              }}
            >
              <Text
                type="secondary"
                style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
              >
                Mô tả
              </Text>
              <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
                {department.note}
              </Text>
            </div>
          )}

          {/* Nhân sự */}
          <div style={{ marginTop: 16 }}>
            <Text strong style={{ fontSize: 14 }}>
              Nhân sự ({members.length})
            </Text>
          </div>
          {members.length === 0 ? (
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Chưa có nhân sự trong phòng ban này.
            </Text>
          ) : (
            <div>
              {visible.map((e) => (
                <MemberRow key={e.id} employee={e} />
              ))}
              {hiddenCount > 0 && (
                <div style={{ paddingTop: 10 }}>
                  <Text type="secondary">
                    Xem tất cả {members.length} nhân sự →
                  </Text>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </DetailDrawer>
  );
}
