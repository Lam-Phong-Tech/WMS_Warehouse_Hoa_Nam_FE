/** Foundation state surfaces. Loading participates in the nearest screen group. */
import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import { MOTION, SEMANTIC_LIGHT as S, SPACING } from "@/shared/ui/tokens";
import { UiIcon } from "./UiIcon";
import { UiText } from "./UiText";
import { useT } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import { UnifiedLoading } from "@/shared/ui/loading/UnifiedLoading";
import { useLoadingParticipant } from "@/shared/ui/loading/loading-context";
export type UiStateKind = "loading" | "empty" | "error" | "no-permission";
const STATE_PRESET: Record<UiStateKind, { icon: string | null; color: string; defaultTitleKey: MessageKey }> = {
  loading: { icon: null, color: S.primary, defaultTitleKey: "shared.states.loadingData" },
  empty: { icon: "inbox", color: S.textDisabled, defaultTitleKey: "shared.states.emptyDefault" },
  error: { icon: "cross-circle", color: S.error, defaultTitleKey: "shared.states.errorTitle" },
  "no-permission": { icon: "lock", color: S.warning, defaultTitleKey: "shared.states.noPermissionContent" },
};
export interface UiStateSurfaceProps { kind: UiStateKind; title?: ReactNode; description?: ReactNode; action?: ReactNode; }
export function UiStateSurface({ kind, title, description, action }: UiStateSurfaceProps) {
  const t = useT();
  useLoadingParticipant(kind === "loading");
  const preset = STATE_PRESET[kind];
  if (kind === "loading") return (
    <><UnifiedLoading label={title ?? t(preset.defaultTitleKey)} />
      {description ? <UiText variant="body">{description}</UiText> : null}{action ?? null}</>
  );
  return (
    <Box role={kind === "error" ? "alert" : "status"}
      data-ui-state={kind === "no-permission" ? "permission-denied" : kind}
      sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: `${SPACING.sm}px`, padding: `${SPACING.xxl}px`, textAlign: "center",
        animation: `hn-fade-in ${MOTION.duration.normal}ms ${MOTION.easing.out} backwards` }}>
      {preset.icon ? <UiIcon name={preset.icon} size="lg" color={preset.color} /> : null}
      <UiText variant="cardTitle">{title ?? t(preset.defaultTitleKey)}</UiText>
      {description ? <UiText variant="body">{description}</UiText> : null}{action ?? null}
    </Box>
  );
}
