import type { ReactNode } from "react";
import type { FormActionButtonProps } from "@/shared/components/feedback/FormActions";
import { Form, Typography } from "antd";
import { COMPONENT_TOKENS, SEMANTIC_LIGHT } from "@/shared/ui/tokens";
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
  okButtonProps?: FormActionButtonProps;
  cancelButtonProps?: FormActionButtonProps;
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
        background: SEMANTIC_LIGHT.bgSurface,
        border: `1px solid ${SEMANTIC_LIGHT.border}`,
        borderRadius: COMPONENT_TOKENS.card.radius,
        boxShadow: COMPONENT_TOKENS.card.shadow,
        padding: COMPONENT_TOKENS.card.paddingDesktop,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Typography.Title
          level={4}
          style={{ margin: 0, color: SEMANTIC_LIGHT.textHigh }}
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
