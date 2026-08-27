/**
 * Foundation Alert — nền soft 16% + chữ đậm cùng dải màu (bộ `*Soft`/`*Text`
 * của tokens, đồng bộ ngôn ngữ màu với UiStatusBadge). Icon mặc định của MUI
 * nhưng đổi màu theo tone.
 */
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import type { ReactNode } from "react";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";

export type UiAlertTone = "success" | "info" | "warning" | "error";

const TONE_STYLES: Record<
  UiAlertTone,
  { bg: string; color: string; icon: string }
> = {
  success: { bg: S.successSoft, color: S.successText, icon: S.success },
  info: { bg: S.infoSoft, color: S.infoText, icon: S.info },
  warning: { bg: S.warningSoft, color: S.warningText, icon: S.warning },
  error: { bg: S.errorSoft, color: S.errorText, icon: S.error },
};

export interface UiAlertProps {
  tone: UiAlertTone;
  title?: ReactNode;
  children: ReactNode;
  /** Có truyền → hiện nút đóng góc phải. */
  onClose?: () => void;
  /** Hành động góc phải (thay chỗ nút đóng mặc định khi truyền cả hai). */
  action?: ReactNode;
}

export function UiAlert({
  tone,
  title,
  children,
  onClose,
  action,
}: UiAlertProps) {
  const style = TONE_STYLES[tone];
  return (
    <Alert
      severity={tone}
      onClose={onClose}
      action={action}
      sx={{
        backgroundColor: style.bg,
        color: style.color,
        "& .MuiAlert-icon": { color: style.icon },
      }}
    >
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {children}
    </Alert>
  );
}
