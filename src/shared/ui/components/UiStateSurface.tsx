/**
 * Foundation state surfaces — Loading / Empty / Error / NoPermission theo một
 * khuôn: icon + tiêu đề + mô tả + hành động (spec X §4: skeleton/empty/error
 * chuẩn; hợp đồng SRS Annex D: error phải hiển thị được request_id qua
 * description, hành động retry rõ ràng).
 */
import Box from "@mui/material/Box";
import { UiSpinner } from "./UiSpinner";
import type { ReactNode } from "react";
import { MOTION, SEMANTIC_LIGHT as S, SPACING } from "@/shared/ui/tokens";
import { UiIcon } from "./UiIcon";
import { UiText } from "./UiText";
import { useT } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";

export type UiStateKind = "loading" | "empty" | "error" | "no-permission";

const STATE_PRESET: Record<
  UiStateKind,
  { icon: string | null; color: string; defaultTitleKey: MessageKey }
> = {
  loading: {
    icon: null,
    color: S.primary,
    defaultTitleKey: "shared.states.loadingData",
  },
  empty: {
    icon: "inbox",
    color: S.textDisabled,
    defaultTitleKey: "shared.states.emptyDefault",
  },
  error: {
    icon: "cross-circle",
    color: S.error,
    defaultTitleKey: "shared.states.errorTitle",
  },
  "no-permission": {
    icon: "lock",
    color: S.warning,
    defaultTitleKey: "shared.states.noPermissionContent",
  },
};

export interface UiStateSurfaceProps {
  kind: UiStateKind;
  title?: ReactNode;
  /** Mô tả phụ — với kind="error" nên kèm request_id (hợp đồng Annex D). */
  description?: ReactNode;
  /** Hành động (vd nút Thử lại) — render dưới mô tả. */
  action?: ReactNode;
}

export function UiStateSurface({
  kind,
  title,
  description,
  action,
}: UiStateSurfaceProps) {
  const t = useT();
  const preset = STATE_PRESET[kind];
  return (
    <Box
      role={kind === "error" ? "alert" : "status"}
      // Hợp đồng WWHN-268: mọi state surface phát test hook data-ui-state
      // (kind "no-permission" map về khoá chuẩn "permission-denied").
      data-ui-state={kind === "no-permission" ? "permission-denied" : kind}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: `${SPACING.sm}px`,
        padding: `${SPACING.xxl}px`,
        textAlign: "center",
        // Đổi loading → dữ liệu / rỗng / lỗi là lúc cả khối bị thay, hiện tức
        // thì sẽ "chớp". Keyframes toàn cục định nghĩa ở hn-motion.css.
        animation: `hn-fade-in ${MOTION.duration.normal}ms ${MOTION.easing.out} backwards`,
      }}
    >
      {kind === "loading" ? (
        <UiSpinner size={28} />
      ) : preset.icon ? (
        <UiIcon name={preset.icon} size="lg" color={preset.color} />
      ) : null}
      <UiText variant="cardTitle">{title ?? t(preset.defaultTitleKey)}</UiText>
      {description ? <UiText variant="body">{description}</UiText> : null}
      {action ?? null}
    </Box>
  );
}
