import type { ChangeEvent } from "react";
import { Box } from "@/shared/ui";
import {
  MOTION,
  OPACITY,
  RADIUS,
  SEMANTIC_LIGHT as S,
} from "@/shared/ui/tokens";

export interface PvSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
}

/**
 * Công tắc bật/tắt token-hoá cho module PV (Part 4 Vuexy sync).
 *
 * Design system chưa có Switch primitive (UiFormSwitch là bản RHF, còn
 * antd/MUI Switch bị cấm import trực tiếp ở feature) — component này là
 * checkbox gốc `role="switch"` + track/thumb vẽ bằng token, giữ nguyên ngữ
 * nghĩa toggle và accessibility (focus ring, disabled, aria-checked).
 * TODO(coordinator): thay bằng UiSwitch khi primitives bổ sung — xem báo cáo
 * Part 4 nhóm PV/Auth/Errors.
 */
export function PvSwitch({
  checked,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: PvSwitchProps) {
  return (
    <Box
      component="span"
      sx={{
        position: "relative",
        display: "inline-flex",
        flexShrink: 0,
        width: 38,
        height: 22,
      }}
    >
      <Box
        component="input"
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        data-testid={dataTestId}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.checked)
        }
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          margin: 0,
          opacity: 0,
          zIndex: 1,
          cursor: "pointer",
          "&:disabled": { cursor: "not-allowed" },
        }}
      />
      <Box
        component="span"
        aria-hidden
        sx={{
          width: "100%",
          height: "100%",
          borderRadius: `${RADIUS.pill}px`,
          backgroundColor: S.grey300,
          transition: `background-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
          "&::after": {
            content: '""',
            position: "absolute",
            top: 2,
            left: 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            backgroundColor: S.bgSurface,
            boxShadow: S.shadowCard,
            transition: `transform ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
          },
          "input:checked + &": { backgroundColor: S.primary },
          "input:checked + &::after": { transform: "translateX(16px)" },
          "input:focus-visible + &": { boxShadow: S.focusRing },
          "input:disabled + &": { opacity: OPACITY.disabled },
        }}
      />
    </Box>
  );
}
