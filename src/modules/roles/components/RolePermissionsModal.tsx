import { useEffect, useMemo, useState } from 'react';
import { Checkbox, Col, Divider, Modal, Row, Spin, Typography } from 'antd';
import { groupBy } from 'lodash-es';
import type { Permission, Role } from '@/modules/roles/types/roles.types';

const { Text } = Typography;

/** Label hiển thị cho từng nhóm object. */
const OBJECT_LABELS: Record<string, string> = {
  org_unit: 'Đơn vị tổ chức',
  department: 'Phòng ban',
  employee: 'Nhân sự',
  position: 'Chức vụ',
  role: 'Vai trò & Quyền',
  user: 'Tài khoản',
  employee_assignment: 'Phân công nhân sự',
  employee_status: 'Trạng thái nhân sự',
  task: 'Công việc',
  warehouse: 'Kho',
};

interface Props {
  open: boolean;
  role: Role | null | undefined;
  allPermissions: Permission[];
  loadingPermissions: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (permissionIds: number[]) => void;
}

/**
 * Modal phân quyền cho vai trò: hiển thị tất cả quyền hệ thống theo nhóm,
 * check những quyền đang có, cho phép sửa rồi lưu.
 */
export function RolePermissionsModal({
  open,
  role,
  allPermissions,
  loadingPermissions,
  saving,
  onCancel,
  onSave,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Khi mở modal, khởi tạo checked = quyền hiện tại của role.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set(role?.permissions?.map((p) => p.id) ?? []));
  }, [open, role]);

  const byObject = useMemo(
    () => groupBy(allPermissions, 'object'),
    [allPermissions],
  );

  const toggle = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleGroup = (perms: Permission[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      perms.forEach((p) => (checked ? next.add(p.id) : next.delete(p.id)));
      return next;
    });
  };

  return (
    <Modal
      open={open}
      title={`Phân quyền: ${role?.name ?? ''}`}
      onCancel={onCancel}
      onOk={() => onSave([...selected])}
      okText="Lưu"
      cancelText="Huỷ"
      confirmLoading={saving}
      width={700}
      destroyOnClose
    >
      {loadingPermissions ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
        </div>
      ) : (
        Object.entries(byObject).map(([object, perms], idx) => {
          const allChecked = perms.every((p) => selected.has(p.id));
          const someChecked = perms.some((p) => selected.has(p.id));
          return (
            <div key={object}>
              {idx > 0 && <Divider style={{ margin: '12px 0' }} />}
              <Checkbox
                checked={allChecked}
                indeterminate={!allChecked && someChecked}
                onChange={(e) => toggleGroup(perms, e.target.checked)}
                style={{ marginBottom: 8 }}
              >
                <Text strong>{OBJECT_LABELS[object] ?? object}</Text>
              </Checkbox>
              <Row gutter={[8, 4]} style={{ paddingLeft: 24 }}>
                {perms.map((p) => (
                  <Col key={p.id} xs={24} sm={12}>
                    <Checkbox
                      checked={selected.has(p.id)}
                      onChange={(e) => toggle(p.id, e.target.checked)}
                    >
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {p.description || p.name || p.code}
                      </Text>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </div>
          );
        })
      )}
    </Modal>
  );
}
