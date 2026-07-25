import { Alert, Input, Modal, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import type {
  Employee,
  CreateAccountResult,
} from '@/modules/employees/types/employees.types';

const { Text, Paragraph } = Typography;

export interface CreateAccountModalProps {
  open: boolean;
  employee: Employee | null;
  loading?: boolean;
  /** Kết quả trả về sau khi cấp tài khoản thành công — có thì modal chuyển sang màn hiển thị mật khẩu tạm. */
  result: CreateAccountResult | null;
  onCancel: () => void;
  /** Không còn nhận password từ FE — BE luôn tự sinh mật khẩu ngẫu nhiên theo đúng BA doc BR-CR-11. */
  onConfirm: () => void;
}

/**
 * Modal cấp tài khoản đăng nhập cho nhân sự.
 * API thật: POST /employees/{id}/account {} (không có password).
 * BE tự sinh mật khẩu mạnh ngẫu nhiên và trả về `temporary_password` —
 * CHỈ trả đúng 1 lần trong response này, không lưu lại được ở đâu khác
 * (xem docs/employee-account-provisioning-flow.md mục 3) nên phải hiển thị
 * ngay cho người thực hiện thao tác copy gửi thủ công.
 *
 * Theo đúng BA doc BR-CR-11: M1 không được tự đặt mật khẩu, luôn để BE
 * tự sinh ngẫu nhiên.
 */
export function CreateAccountModal({
  open,
  employee,
  loading,
  result,
  onCancel,
  onConfirm,
}: CreateAccountModalProps) {
  const handleAfterClose = () => {
    // Không còn state password cần reset
  };

  const handleOk = () => {
    if (result) {
      onCancel();
      return;
    }
    onConfirm();
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Đã sao chép ${label}`);
    } catch {
      toast.error(`Không sao chép được ${label} — vui lòng copy thủ công`);
    }
  };

  return (
    <Modal
      open={open}
      title={result ? 'Đã cấp tài khoản thành công' : 'Cấp tài khoản đăng nhập'}
      onCancel={onCancel}
      onOk={handleOk}
      okText={result ? 'Đã lưu, đóng' : 'Cấp tài khoản'}
      cancelText="Hủy"
      confirmLoading={loading}
      afterClose={handleAfterClose}
      cancelButtonProps={result ? { style: { display: 'none' } } : undefined}
      closable={!result}
      maskClosable={!result}
      destroyOnHidden
    >
      {result ? (
        <>
          <Alert
            type="warning"
            showIcon
            message="Mật khẩu tạm chỉ hiển thị đúng 1 lần ở đây"
            description="Hãy sao chép và gửi thủ công cho nhân viên ngay bây giờ — hệ thống không lưu lại và sẽ không hiển thị lại được nữa."
            style={{ marginBottom: 16 }}
          />
          <Paragraph>
            Email đăng nhập: <Text strong>{result.email}</Text>
          </Paragraph>
          <div style={{ marginTop: 16 }}>
            <label
              style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}
            >
              Mật khẩu tạm
            </label>
            <Input
              readOnly
              value={result.temporaryPassword}
              suffix={
                <CopyOutlined
                  onClick={() =>
                    handleCopy(result.temporaryPassword, 'mật khẩu tạm')
                  }
                  style={{ cursor: 'pointer' }}
                />
              }
            />
          </div>
        </>
      ) : (
        <>
          <p>
            Cấp tài khoản đăng nhập cho nhân sự{' '}
            <Text strong>{employee?.fullName}</Text>
            {employee?.email ? (
              <>
                {' '}
                (email đăng nhập: <Text strong>{employee.email}</Text>)
              </>
            ) : (
              '.'
            )}
          </p>

          {!employee?.email && (
            <Alert
              type="warning"
              showIcon
              message="Nhân sự chưa có email — vui lòng bổ sung email trước khi cấp tài khoản."
              style={{ marginBottom: 16 }}
            />
          )}

          <Alert
            type="info"
            showIcon
            message="Hệ thống sẽ tự sinh mật khẩu mạnh ngẫu nhiên."
            style={{ marginBottom: 16 }}
          />
        </>
      )}
    </Modal>
  );
}
