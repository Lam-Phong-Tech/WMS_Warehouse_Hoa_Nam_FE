/**
 * UiBreadcrumb — breadcrumb canonical trên MUI Breadcrumbs (Part 3).
 *
 * Phần tử cuối = trang hiện tại: aria-current="page", màu textHigh; các phần
 * tử trước là button điều hướng màu textMedium. Separator mặc định "/".
 */
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import { MOTION, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui/tokens";

export interface UiBreadcrumbItem {
  label: ReactNode;
  /** Điều hướng do caller quyết định (router nối ở Part 4). */
  onClick?: () => void;
}

export interface UiBreadcrumbProps {
  items: UiBreadcrumbItem[];
  /** Separator giữa các phần tử — mặc định "/". */
  separator?: ReactNode;
}

export function UiBreadcrumb({ items, separator = "/" }: UiBreadcrumbProps) {
  return (
    <Breadcrumbs
      aria-label="Breadcrumb"
      separator={separator}
      sx={{ fontSize: TYPOGRAPHY.fontSizeSecondary, color: S.textMedium }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (isLast) {
          return (
            <Box
              key={index}
              component="span"
              aria-current="page"
              sx={{ color: S.textHigh, fontSize: TYPOGRAPHY.fontSizeSecondary }}
            >
              {item.label}
            </Box>
          );
        }
        return (
          <Box
            key={index}
            component="button"
            type="button"
            onClick={item.onClick}
            sx={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: TYPOGRAPHY.fontSizeSecondary,
              color: S.textMedium,
              transition: `color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
              "&:hover": { color: S.primary },
              "&:focus-visible": { outline: "none", boxShadow: S.focusRing },
            }}
          >
            {item.label}
          </Box>
        );
      })}
    </Breadcrumbs>
  );
}
