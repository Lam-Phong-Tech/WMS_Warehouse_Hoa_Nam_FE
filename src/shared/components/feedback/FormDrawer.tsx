import type { ReactNode } from "react";
import type { FormActionButtonProps } from "@/shared/components/feedback/FormActions";
import { Drawer, Form } from "antd";
import { FormActions } from "./FormActions";

export interface FormDrawerProps {
  /** Whether the drawer is visible */
  open: boolean;
  /** Title of the drawer - can be a string or function that receives mode */
  title?: ReactNode | ((mode: "create" | "edit" | "view") => ReactNode);
  /** Default title when mode is create */
  createTitle?: ReactNode;
  /** Default title when mode is edit */
  editTitle?: ReactNode;
  /** Default title when mode is view */
  viewTitle?: ReactNode;
  /** Handler for the OK button - typically handleSubmit from react-hook-form */
  onOk: () => void;
  /** Handler for cancel/close */
  onCancel: () => void;
  /** Loading state for the submit button */
  loading?: boolean;
  /** Text for the OK button */
  okText?: string;
  /** Text for the cancel button */
  cancelText?: string;
  /** Width of the drawer */
  width?: number | string;
  /** Placement of the drawer */
  placement?: "left" | "right" | "top" | "bottom";
  /** Whether to show the cancel button */
  showCancel?: boolean;
  /** Whether to show the OK button */
  showOk?: boolean;
  /** Custom props for the OK button */
  okButtonProps?: FormActionButtonProps;
  /** Custom props for the cancel button */
  cancelButtonProps?: FormActionButtonProps;
  /** Extra content to render at the top of the drawer */
  extra?: ReactNode;
  /** Footer content - if not provided, default footer with OK/Cancel will be shown */
  footer?: ReactNode;
  /** Whether to destroy the drawer content when closed */
  destroyOnClose?: boolean;
  /** Callback after drawer is closed */
  afterClose?: () => void;
  /** Children form content */
  children: ReactNode;
  /** Current form mode - determines title and button behavior */
  mode?: "create" | "edit" | "view";
}

/**
 * Drawer wrapper for forms - supports Create/Edit/View modes
 *
 * @example
 * ```tsx
 * <FormDrawer
 *   open={open}
 *   title={mode === 'create' ? 'Thêm đơn vị' : 'Sửa đơn vị'}
 *   onOk={submitForm}
 *   onCancel={onCancel}
 *   loading={isSubmitting}
 *   mode={mode}
 * >
 *   <FormInput control={control} name="code" label="Mã" />
 *   <FormInput control={control} name="name" label="Tên" />
 * </FormDrawer>
 * ```
 *
 * @example With dynamic title based on mode
 * ```tsx
 * <FormDrawer
 *   open={open}
 *   title={(mode) => mode === 'create' ? 'Thêm mới' : mode === 'edit' ? 'Chỉnh sửa' : 'Chi tiết'}
 *   onOk={submitForm}
 *   onCancel={onCancel}
 *   mode={mode}
 *   showOk={mode !== 'view'}
 * >
 *   {children}
 * </FormDrawer>
 * ```
 */
export function FormDrawer({
  open,
  title,
  createTitle = "Thêm mới",
  editTitle = "Chỉnh sửa",
  viewTitle = "Chi tiết",
  onOk,
  onCancel,
  loading = false,
  okText = "Lưu",
  cancelText = "Hủy",
  width = "min(520px, calc(100vw - 32px))",
  placement = "right",
  showCancel = true,
  showOk = true,
  okButtonProps,
  cancelButtonProps,
  extra,
  footer,
  destroyOnClose = true,
  afterClose,
  children,
  mode = "create",
}: FormDrawerProps) {
  // Resolve title based on mode
  const resolvedTitle =
    typeof title === "function"
      ? title(mode)
      : (title ??
        (mode === "create"
          ? createTitle
          : mode === "edit"
            ? editTitle
            : viewTitle));

  // In view mode, typically we don't show action buttons
  const showActions = mode !== "view";

  return (
    <Drawer
      open={open}
      title={resolvedTitle}
      onClose={onCancel}
      // Cố ý dùng `size` chứ không phải `width`: antd v6 (@rc-component/drawer)
      // deprecate `width`/`height` riêng lẻ, và quan trọng hơn — `width` chỉ có
      // tác dụng khi placement ngang (left/right); với placement="top"/"bottom"
      // nó bị bỏ qua hoàn toàn (xem DrawerPopup.js: `legacySize = isHorizontal
      // ? width : height`). `size` tự map đúng theo placement nên hoạt động
      // đúng cho cả 4 hướng mà FormDrawer hỗ trợ.
      size={width}
      placement={placement}
      destroyOnClose={destroyOnClose}
      afterOpenChange={(isOpen) => {
        if (!isOpen) afterClose?.();
      }}
      extra={extra}
      footer={
        footer ??
        (showActions ? (
          <div className="hn-drawer-footer-actions">
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
        ) : null)
      }
    >
      <Form layout="vertical">{children}</Form>
    </Drawer>
  );
}

/**
 * FormDrawer with built-in form state management
 * Combines useFormPattern with FormDrawer for convenience
 *
 * @example
 * ```tsx
 * const { control, submitForm, errors, isSubmitting, mode, setMode, setValues, resetForm } = useFormPattern({
 *   schema: CreateOrgUnitSchema,
 *   defaultValues: { type: 'branch', status: 'active' },
 *   onSubmit: async (data) => {
 *     await createOrgUnit(data);
 *   },
 * });
 *
 * <FormDrawer
 *   open={open}
 *   onOk={submitForm}
 *   onCancel={() => {
 *     setOpen(false);
 *     resetForm();
 *   }}
 *   loading={isSubmitting}
 *   mode={mode}
 * >
 *   <FormInput control={control} name="code" label="Mã" />
 * </FormDrawer>
 * ```
 */
