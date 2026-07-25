import { Button, Descriptions, Empty, Space, Tag, Typography } from 'antd';
import { toast } from 'sonner';

import { KeyOutlined } from '@ant-design/icons';
import { DetailDrawer } from '@/shared/components';
import { formatDate } from '@/shared/utils/format-date';
import {
  GENDER_LABELS,
  type Employee,
  type CreateAccountResult,
  EMPLOYEE_STATUS_LABELS,
  EmployeeStatus,
} from '@/modules/employees/types/employees.types';
import { useState } from 'react';
import { usePermission } from '@/shared/components/permission';
import { useCreateEmployeeAccount } from '@/modules/employees/hooks/use-employees';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { CreateAccountModal } from '@/modules/employees/components/CreateAccountModal';

const { Text } = Typography;

interface Props {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
}

const dash = (v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : String(v);

const date = (v?: string | null) => (v ? formatDate(v) : '—');

/** P1.4: Account status label */
function getAccountStatusLabel(status: number | null | undefined): {
  label: string;
  color: string;
} {
  if (status == null) return { label: 'Chưa cấp tài khoản', color: 'default' };
  if (status === 1) return { label: 'Đang hoạt động', color: 'blue' };
  if (status === 0) return { label: 'Đã khóa', color: 'red' };
  return { label: String(status), color: 'default' };
}

/** Drawer xem đầy đủ thông tin một nhân sự. */
export function EmployeeDetailDrawer({ open, employee, onClose }: Props) {
  const createAccountMutation = useCreateEmployeeAccount();
  const { can: canCreateAccount } = usePermission({
    permissionCode: 'EMP_ACCOUNT_CREATE',
  });
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [accountResult, setAccountResult] =
    useState<CreateAccountResult | null>(null);

  const handleConfirmCreateAccount = () => {
    if (!employee) return;
    createAccountMutation.mutate(
      { id: employee.id },
      {
        onSuccess: (result) => {
          toast.success('Cấp tài khoản thành công');
          // Giữ modal mở để hiển thị mật khẩu tạm (chỉ trả về đúng 1 lần).
          setAccountResult(result);
        },
        onError: (err) => {
          toast.error('Lỗi cấp tài khoản: ' + getApiErrorMessage(err));
        },
      },
    );
  };

  const handleCloseCreateAccount = () => {
    setCreateAccountOpen(false);
    setAccountResult(null);
  };

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      width={560}
      title={
        employee
          ? `${employee.code} — ${employee.fullName}`
          : 'Chi tiết nhân sự'
      }
    >
      {!employee ? (
        <Empty />
      ) : (
        <>
          <Descriptions
            title="Thông tin cá nhân"
            column={1}
            size="small"
            bordered
          >
            <Descriptions.Item label="Mã nhân sự">
              {dash(employee.code)}
            </Descriptions.Item>
            <Descriptions.Item label="Họ tên">
              {dash(employee.fullName)}
            </Descriptions.Item>
            <Descriptions.Item label="Giới tính">
              {employee.gender != null
                ? (GENDER_LABELS[employee.gender] ?? String(employee.gender))
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày sinh">
              {date(employee.birthday)}
            </Descriptions.Item>
            <Descriptions.Item label="CCCD">
              {dash(employee.cccd)}
            </Descriptions.Item>
            <Descriptions.Item label="Mã số thuế cá nhân">
              {dash(employee.personalTaxCode)}
            </Descriptions.Item>
            <Descriptions.Item label="Điện thoại">
              {dash(employee.phone)}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {dash(employee.email)}
            </Descriptions.Item>
            <Descriptions.Item label="Địa chỉ">
              {dash(employee.address)}
            </Descriptions.Item>
          </Descriptions>

          <Descriptions
            title="Công việc"
            column={1}
            size="small"
            bordered
            style={{ marginTop: 16 }}
          >
            <Descriptions.Item label="Ngày vào làm">
              {date(employee.hireDate)}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái làm việc">
              {employee.employeeStatus != null
                ? (EMPLOYEE_STATUS_LABELS[
                    employee.employeeStatus as EmployeeStatus
                  ] ?? String(employee.employeeStatus))
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Quản lý trực tiếp">
              {employee.managerName ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {employee.status === 1 ? (
                <Tag color="green">Đang làm</Tag>
              ) : (
                <Tag>Đã nghỉ</Tag>
              )}
            </Descriptions.Item>
            {/* P1.4 / P0.6: Account status với label rõ ràng + action */}
            <Descriptions.Item label="Trạng thái tài khoản">
              <Space>
                <Tag
                  color={getAccountStatusLabel(employee.accountStatus).color}
                >
                  {getAccountStatusLabel(employee.accountStatus).label}
                </Tag>
                {employee.accountStatus == null && canCreateAccount && (
                  <Button
                    type="link"
                    size="small"
                    icon={<KeyOutlined />}
                    loading={createAccountMutation.isPending}
                    onClick={() => setCreateAccountOpen(true)}
                  >
                    Cấp tài khoản
                  </Button>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">
              {date(employee.created_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Cập nhật">
              {date(employee.updated_at)}
            </Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 16 }}>
            {employee.assignments && employee.assignments.length > 0 ? (
              employee.assignments.map((a, i) => {
                const hasMultiple = employee.assignments!.length > 1;
                return (
                  <div
                    key={a.id ?? i}
                    style={{
                      marginTop: 8,
                      padding: '10px 12px',
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <Text strong>
                        {hasMultiple ? `Phân công #${i + 1}` : 'Phân công'}
                      </Text>
                      {hasMultiple && a.is_primary && (
                        <Tag
                          color="gold"
                          title="Phân công chính — dùng để hiển thị đơn vị/phòng ban/chức vụ của nhân sự ở các danh sách"
                        >
                          Chính
                        </Tag>
                      )}
                    </div>
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="Đơn vị">
                        {a.org_unit?.name ?? dash(a.org_unit_id)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phòng ban">
                        {a.department?.name ?? dash(a.department_id)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Chức vụ">
                        {a.position?.name ?? dash(a.position_id)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Cấp bậc">
                        {dash(a.position?.grade)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Hiệu lực">
                        {date(a.start_date)} — {date(a.end_date)}
                      </Descriptions.Item>
                    </Descriptions>
                  </div>
                );
              })
            ) : (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Chưa có phân công
              </Text>
            )}
          </div>
        </>
      )}

      <CreateAccountModal
        open={createAccountOpen}
        employee={employee}
        loading={createAccountMutation.isPending}
        result={accountResult}
        onCancel={handleCloseCreateAccount}
        onConfirm={handleConfirmCreateAccount}
      />
    </DetailDrawer>
  );
}
