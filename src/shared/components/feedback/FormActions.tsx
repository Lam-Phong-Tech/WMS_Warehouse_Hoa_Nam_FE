import type { ButtonProps } from "antd";
import { Button } from "antd";
import { CloseOutlined, SaveOutlined } from "@/shared/components/icons";
import {
  ACCENT_COLORS,
  FONT_FAMILY,
  NEUTRAL_COLORS,
} from "@/shared/design-tokens";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";

export interface FormActionsProps {
  onOk: () => void;
  onCancel: () => void;
  loading?: boolean;
  okText?: string;
  cancelText?: string;
  showOk?: boolean;
  showCancel?: boolean;
  okButtonProps?: ButtonProps;
  cancelButtonProps?: ButtonProps;
}

const cancelStyle = {
  height: 38,
  padding: "0 18px",
  border: `1.5px solid ${NEUTRAL_COLORS.ink}`,
  borderRadius: 3,
  background: NEUTRAL_COLORS.paper,
  color: NEUTRAL_COLORS.ink,
  fontSize: 14,
  fontFamily: FONT_FAMILY,
};

const okStyle = {
  height: 38,
  padding: "0 22px",
  background: ACCENT_COLORS.accent,
  fontSize: 15,
  fontWeight: 700,
  fontFamily: FONT_FAMILY,
};

/**
 * Hàng nút Hủy/Lưu theo §6.5 (Button) của Design System Module 1 — dùng chung
 * cho `FormDrawer`/`FormModal`/`FormPage` thay vì mỗi nơi tự vẽ style JSX.
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
        <Button
          icon={<CloseOutlined style={{ color: ACTION_ICON_COLORS.neutral }} />}
          onClick={onCancel}
          style={cancelStyle}
          {...cancelButtonProps}
        >
          {cancelText}
        </Button>
      )}
      {showOk && (
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={onOk}
          loading={loading}
          className={loading ? "ant-btn-loading" : undefined}
          style={okStyle}
          {...okButtonProps}
        >
          {okText}
        </Button>
      )}
    </div>
  );
}
