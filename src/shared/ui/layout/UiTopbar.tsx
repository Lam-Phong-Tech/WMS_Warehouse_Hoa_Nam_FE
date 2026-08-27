/**
 * UiTopbar — thanh trên cùng canonical Vuexy (Part 3, PRESENTATIONAL ONLY).
 *
 * Baseline: sticky top 0, cao LAYOUT.topbarHeight (~80px), nền surface trắng,
 * border-bottom token, padding ngang 24, z-index thang Z_INDEX.header.
 */
import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import { SEMANTIC_LIGHT as S, SPACING, Z_INDEX } from "@/shared/ui/tokens";
import { LAYOUT } from "./layout-tokens";

export interface UiTopbarProps {
  /** Cụm bên trái (nút thu gọn sidebar, search…). */
  left?: ReactNode;
  /** Cụm bên phải (thông báo, user menu…). */
  right?: ReactNode;
}

export function UiTopbar({ left, right }: UiTopbarProps) {
  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        height: LAYOUT.topbarHeight,
        flexShrink: 0,
        backgroundColor: S.bgSurface,
        borderBottom: `1px solid ${S.border}`,
        paddingLeft: `${SPACING.xl}px`,
        paddingRight: `${SPACING.xl}px`,
        zIndex: Z_INDEX.header,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: `${SPACING.lg}px`,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: `${SPACING.md}px`,
          minWidth: 0,
        }}
      >
        {left ?? null}
      </Box>
      <Box
        sx={{ display: "flex", alignItems: "center", gap: `${SPACING.md}px` }}
      >
        {right ?? null}
      </Box>
    </Box>
  );
}
