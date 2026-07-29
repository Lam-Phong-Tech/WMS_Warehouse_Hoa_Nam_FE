import type { ReactNode } from "react";
import type { ButtonProps } from "antd";
import { Form, Typography } from "antd";
import { CARD_SHADOW, NEUTRAL_COLORS, RADIUS } from "@/shared/design-tokens";
import { FormActions } from "./FormActions";

export interface FormPageProps {
  /** Tiêu đề trang (§3 Typography: "Tiêu đề trang" 23px/700). */
  title: ReactNode;
  onOk: () => void;
  onCancel: () => void;
  loading?: boolean;
  okText?: string;
  cancelText?: string;
  showOk?: boolean;
  showCancel?: boolean;
  okButtonProps?: ButtonProps;
  cancelButtonProps?: ButtonProps;
  /** Nội dung phụ dưới tiêu đề (vd breadcrumb, mô tả ngắn). */
  extra?: ReactNode;
  children: ReactNode;
}

/**
 * Khung form dạng TRANG (không phải overlay) — dùng khi wireframe yêu cầu
 * "Form view" độc lập thay vì Drawer/Modal (§8 Layout patterns: "Form view:
 * Tiêu đề → các nhóm trường → hàng nút (Hủy/Lưu) căn phải").
 *
 * Hoàn thiện bộ 3 pattern form theo mô tả Jira gốc — trước đó chỉ có
 * Drawer/Modal, chưa có Page. Dùng `FormSection` để chia nhóm trường bên
 * trong.
 *
 * @example
 * ```tsx
 * <FormPage title="Thêm nhân viên mới" onOk={submitForm} onCancel={onCancel} loading={isSubmitting}>
 *   <FormSection title="Thông tin cơ bản" />
 *   <FormInput control={control} name="fullName" label="Họ tên" />
 * </FormPage>
 * ```
 */
export function FormPage({
  title,
  onOk,
  onCancel,
  loading,
  okText,
  cancelText,
  showOk,
  showCancel,
  okButtonProps,
  cancelButtonProps,
  extra,
  children,
}: FormPageProps) {
  return (
    <div
      style={{
        background: NEUTRAL_COLORS.paper,
        border: `2px solid ${NEUTRAL_COLORS.ink}`,
        borderRadius: RADIUS.card,
        boxShadow: CARD_SHADOW,
        padding: 22,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Typography.Title
          level={4}
          style={{ margin: 0, color: NEUTRAL_COLORS.ink }}
        >
          {title}
        </Typography.Title>
        {extra}
      </div>
      <Form layout="vertical">{children}</Form>
      <div style={{ marginTop: 20 }}>
        <FormActions
          onOk={onOk}
          onCancel={onCancel}
          loading={loading}
          okText={okText}
          cancelText={cancelText}
          showOk={showOk}
          showCancel={showCancel}
          okButtonProps={okButtonProps}
          cancelButtonProps={cancelButtonProps}
        />
      </div>
    </div>
  );
}
