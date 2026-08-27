/**
 * UiFooter — footer canonical của shell (Part 3).
 * Caption 12 màu textDisabled (qua UiText caption), padding SPACING.lg,
 * căn giữa.
 */
import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import { SPACING } from "@/shared/ui/tokens";
import { UiText } from "@/shared/ui/components";

export interface UiFooterProps {
  children?: ReactNode;
}

export function UiFooter({ children }: UiFooterProps) {
  return (
    <Box
      component="footer"
      sx={{ padding: `${SPACING.lg}px`, textAlign: "center" }}
    >
      {children != null ? <UiText variant="caption">{children}</UiText> : null}
    </Box>
  );
}
