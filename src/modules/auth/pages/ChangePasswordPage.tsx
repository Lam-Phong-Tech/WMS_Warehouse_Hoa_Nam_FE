import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, Form, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { Navigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useChangePassword } from '@/modules/auth/hooks/use-change-password';
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@/modules/auth/schemas/change-password.schema';
import { FormInput } from '@/shared/components/forms';
import { BRAND } from '@/app/theme';
import { useAuthStore } from '@/shared/store/auth.store';
import { ROUTES } from '@/shared/constants/routes';

/**
 * Màn bắt buộc đổi mật khẩu lần đầu (password_change_required=true).
 * BE chặn 403 PASSWORD_CHANGE_REQUIRED ở mọi API trừ login/logout/change-password
 * (xem docs/employee-account-provisioning-flow.md mục 4) — trang này đứng
 * ngoài ProtectedRoute (không gọi /auth/me) để tránh vòng lặp chặn khi hồ sơ
 * chưa nạp được.
 */
export function ChangePasswordPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const changePassword = useChangePassword();
  const { control, handleSubmit, setError } = useForm<ChangePasswordFormValues>(
    {
      resolver: zodResolver(changePasswordSchema),
      defaultValues: {
        currentPassword: '',
        newPassword: '',
        newPasswordConfirmation: '',
      },
    },
  );

  const onSubmit = handleSubmit((values) =>
    changePassword.mutate({
      current_password: values.currentPassword,
      new_password: values.newPassword,
      new_password_confirmation: values.newPasswordConfirmation,
    }),
  );

  const errorMessage = changePassword.isError
    ? isAxiosError(changePassword.error)
      ? (changePassword.error.response?.data?.message ??
        'Đổi mật khẩu thất bại')
      : 'Đổi mật khẩu thất bại'
    : null;

  // Lỗi "mật khẩu hiện tại không đúng" nên gắn vào đúng field thay vì banner chung.
  useEffect(() => {
    if (!errorMessage) return;
    if (/mật khẩu hiện tại/i.test(errorMessage)) {
      setError('currentPassword', { type: 'server', message: errorMessage });
    }
  }, [errorMessage, setError]);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: BRAND.gradient,
      }}
    >
      <Card
        variant="borderless"
        style={{
          width: 420,
          maxWidth: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
        }}
        styles={{ body: { padding: 32 } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 12px',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: BRAND.gradient,
              color: '#fff',
              fontSize: 24,
            }}
          >
            <LockOutlined />
          </div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Đổi mật khẩu
          </Typography.Title>
          <Typography.Text type="secondary">
            Đây là lần đăng nhập đầu tiên — vui lòng đặt mật khẩu mới trước khi
            tiếp tục sử dụng hệ thống.
          </Typography.Text>
        </div>

        {errorMessage && !/mật khẩu hiện tại/i.test(errorMessage) && (
          <Alert
            type="error"
            description={errorMessage}
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        <Form layout="vertical" onSubmitCapture={onSubmit} requiredMark={false}>
          <FormInput
            control={control}
            name="currentPassword"
            label="Mật khẩu hiện tại"
            placeholder="Mật khẩu tạm/hiện tại"
            prefix={<LockOutlined style={{ color: '#bbb' }} />}
            password
            autoFocus
          />

          <FormInput
            control={control}
            name="newPassword"
            label="Mật khẩu mới"
            placeholder="Tối thiểu 8 ký tự, có hoa/thường/ký tự đặc biệt"
            prefix={<LockOutlined style={{ color: '#bbb' }} />}
            password
          />

          <FormInput
            control={control}
            name="newPasswordConfirmation"
            label="Xác nhận mật khẩu mới"
            placeholder="Nhập lại mật khẩu mới"
            prefix={<LockOutlined style={{ color: '#bbb' }} />}
            password
          />

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={changePassword.isPending}
            style={{ marginTop: 8 }}
          >
            Đổi mật khẩu
          </Button>
        </Form>
      </Card>
    </div>
  );
}
