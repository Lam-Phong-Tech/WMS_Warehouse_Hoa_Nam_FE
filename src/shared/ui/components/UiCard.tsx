/**
 * Foundation Card — surface trắng, radius 6, bóng mềm Vuexy (token), tiêu đề
 * card 18/600. "Một card một mục đích" (spec X §1) — không lồng card trắng.
 */
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import { COMPONENT_TOKENS as C } from "@/shared/ui/tokens";
import { UiText } from "./UiText";

export interface UiCardProps {
  title?: ReactNode;
  /** Hành động góc phải header (button/icon). */
  action?: ReactNode;
  children: ReactNode;
  /** Bỏ padding thân card (vd bảng full-bleed). */
  disablePadding?: boolean;
  className?: string;
}

export function UiCard({
  title,
  action,
  children,
  disablePadding = false,
  className,
}: UiCardProps) {
  return (
    <Paper
      elevation={0}
      className={className}
      sx={{
        borderRadius: `${C.card.radius}px`,
        boxShadow: C.card.shadow,
        overflow: "hidden",
      }}
    >
      {title ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            px: `${C.card.paddingDesktop}px`,
            pt: `${C.card.paddingDesktop}px`,
            pb: disablePadding ? `${C.card.paddingMobile}px` : 0,
          }}
        >
          <UiText variant="cardTitle">{title}</UiText>
          {action ?? null}
        </Box>
      ) : null}
      <Box sx={{ p: disablePadding ? 0 : `${C.card.paddingDesktop}px` }}>
        {children}
      </Box>
    </Paper>
  );
}
