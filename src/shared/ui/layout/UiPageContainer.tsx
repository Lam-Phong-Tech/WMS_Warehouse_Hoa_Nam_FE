/**
 * UiPageContainer — khung nội dung trang canonical Vuexy (Part 3).
 *
 * Padding trang 24 (SPACING.xl) theo baseline; header gồm breadcrumb (trên),
 * hàng title/subtitle bên trái + actions bên phải; các khối cách nhau
 * SPACING.lg.
 */
import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import { SPACING } from "@/shared/ui/tokens";
import { UiText } from "@/shared/ui/components";

export interface UiPageContainerProps {
  /** Tiêu đề trang (UiText pageTitle). */
  title?: ReactNode;
  /** Mô tả phụ dưới tiêu đề (UiText secondary). */
  subtitle?: ReactNode;
  /** Cụm hành động góc phải header (button…). */
  actions?: ReactNode;
  /** Breadcrumb phía trên tiêu đề (thường là UiBreadcrumb). */
  breadcrumb?: ReactNode;
  children: ReactNode;
}

export function UiPageContainer({
  title,
  subtitle,
  actions,
  breadcrumb,
  children,
}: UiPageContainerProps) {
  const hasHeader = Boolean(title || subtitle || actions || breadcrumb);

  return (
    <Box
      sx={{
        padding: `${SPACING.xl}px`,
        display: "flex",
        flexDirection: "column",
        gap: `${SPACING.lg}px`,
      }}
    >
      {hasHeader ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: `${SPACING.sm}px`,
          }}
        >
          {breadcrumb ?? null}
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: `${SPACING.lg}px`,
              flexWrap: "wrap",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: `${SPACING.xs}px`,
                minWidth: 0,
              }}
            >
              {title ? <UiText variant="pageTitle">{title}</UiText> : null}
              {subtitle ? (
                <UiText variant="secondary">{subtitle}</UiText>
              ) : null}
            </Box>
            {actions ? (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: `${SPACING.sm}px`,
                  flexShrink: 0,
                }}
              >
                {actions}
              </Box>
            ) : null}
          </Box>
        </Box>
      ) : null}
      {children}
    </Box>
  );
}
