/**
 * Foundation Confirm dialog — hộp thoại xác nhận controlled, dựng trên
 * UiDialog + UiButton. tone="danger" cho hành động phá huỷ (nút xác nhận đỏ).
 */
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import { UiButton } from "./UiButton";
import { UiDialog } from "./UiDialog";

export interface UiConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  /** Mô tả/diễn giải dưới tiêu đề. */
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: "primary" | "danger";
  /** Đang gửi — khoá cả hai nút + spinner trên nút xác nhận. */
  loading?: boolean;
  onConfirm: () => void;
  /** Đóng dialog (nút Hủy / Escape / click backdrop). */
  onClose: () => void;
}

export function UiConfirmDialog({
  open,
  title,
  children,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  tone = "primary",
  loading = false,
  onConfirm,
  onClose,
}: UiConfirmDialogProps) {
  return (
    <UiDialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title={title}
      actions={
        <>
          <UiButton
            appearance="text"
            color="secondary"
            disabled={loading}
            onClick={onClose}
          >
            {cancelText}
          </UiButton>
          <UiButton
            color={tone === "danger" ? "error" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmText}
          </UiButton>
        </>
      }
    >
      {/* Hợp đồng WWHN-268: bề mặt confirm phát test hook data-ui-state. */}
      <Box data-ui-state="confirm">{children}</Box>
    </UiDialog>
  );
}
