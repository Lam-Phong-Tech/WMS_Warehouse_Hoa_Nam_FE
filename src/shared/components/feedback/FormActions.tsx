import {
  ActionButton,
  type ActionButtonProps,
} from "@/shared/components/actions";

/** Prop bổ sung cho từng nút, KHÔNG cho ghi đè `kind` để giữ chuẩn icon/màu. */
export type FormActionButtonProps = Omit<ActionButtonProps, "kind" | "onClick">;

export interface FormActionsProps {
  onOk: () => void;
  onCancel: () => void;
  loading?: boolean;
  okText?: string;
  cancelText?: string;
  showOk?: boolean;
  showCancel?: boolean;
  okButtonProps?: FormActionButtonProps;
  cancelButtonProps?: FormActionButtonProps;
}

/**
 * Hàng nút Hủy/Lưu dùng chung cho `FormDrawer`/`FormModal`/`FormPage`.
 *
 * Hình thức lấy nguyên từ `<ActionButton />` (nền phẳng, icon tô màu theo
 * nghiệp vụ) — KHÔNG tự vẽ style riêng nữa, để mọi form trong dự án giống nhau.
 */
export function FormActions({
  onOk,
  onCancel,
  loading = false,
  okText = "Lưu",
  cancelText = "Hủy",
  showOk = true,
  showCancel = true,
  okButtonProps,
  cancelButtonProps,
}: FormActionsProps) {
  if (!showOk && !showCancel) return null;
  return (
    <div
      className="hn-form-actions"
      style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
    >
      {showCancel && (
        <ActionButton kind="cancel" onClick={onCancel} {...cancelButtonProps}>
          {cancelText}
        </ActionButton>
      )}
      {showOk && (
        <ActionButton
          kind="save"
          onClick={onOk}
          loading={loading}
          {...okButtonProps}
        >
          {okText}
        </ActionButton>
      )}
    </div>
  );
}
