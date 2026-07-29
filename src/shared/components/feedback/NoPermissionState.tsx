import { LockOutlined } from "@ant-design/icons";
import { Button, Result, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/shared/constants/routes";

const { Paragraph } = Typography;

/**
 * Reusable "No Permission" state component for 403 errors.
 *
 * Usage:
 * ```tsx
 * try {
 *   await someApiCall();
 * } catch (error) {
 *   if (isNoPermissionError(error)) {
 *     setShowNoPermission(true);
 *   }
 * }
 *
 * {showNoPermission && <NoPermissionState />}
 * ```
 */
export interface NoPermissionStateProps {
  title?: string;
  description?: string | React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  showHomeButton?: boolean;
  /** Bản thu gọn để nhúng trong 1 khối/section (vd thay cho ApiErrorAlert), không chiếm toàn trang. */
  compact?: boolean;
}

export function NoPermissionState({
  title = "Bạn không có quyền truy cập",
  description = "Bạn không có quyền thực hiện thao tác này. Liên hệ quản trị viên để được cấp quyền.",
  actionText = "Quay lại",
  onAction,
  showHomeButton = true,
  compact = false,
}: NoPermissionStateProps) {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      navigate(-1); // Go back to previous page
    }
  };

  const handleGoHome = () => {
    navigate(ROUTES.HOME);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: compact ? undefined : "400px",
        padding: compact ? "24px 0" : 24,
      }}
    >
      <Result
        icon={
          <LockOutlined
            style={{ color: "#faad14", fontSize: compact ? 40 : 64 }}
          />
        }
        title={
          <Typography.Title level={compact ? 4 : 3} style={{ marginTop: 16 }}>
            {title}
          </Typography.Title>
        }
        extra={
          <Space direction="vertical" size="middle" style={{ marginTop: 24 }}>
            <Paragraph type="secondary" style={{ maxWidth: 400 }}>
              {description}
            </Paragraph>
            <Space>
              <Button type="primary" onClick={handleAction}>
                {actionText}
              </Button>
              {showHomeButton && (
                <Button onClick={handleGoHome}>Về trang chủ</Button>
              )}
            </Space>
          </Space>
        }
      />
    </div>
  );
}
