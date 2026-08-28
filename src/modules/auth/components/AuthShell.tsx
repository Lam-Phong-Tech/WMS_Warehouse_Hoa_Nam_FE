import type { ReactNode } from "react";
import { Box, CircularProgress, UiCard, type BoxProps } from "@/shared/ui";
import {
  RADIUS,
  SEMANTIC_LIGHT as S,
  Z_INDEX,
  inkAlpha,
} from "@/shared/ui/tokens";

export interface AuthShellProps {
  /** id của h1 — section aria-labelledby trỏ về đây (giữ hợp đồng a11y cũ). */
  titleId: string;
  title: ReactNode;
  subtitle: ReactNode;
  /** Text overlay loading chặn toàn màn — null/undefined = không hiện. */
  loadingText?: string | null;
  children: ReactNode;
}

/**
 * Vỏ các màn auth (Login / ChangePassword / ForgotPassword) — Part 4 Vuexy
 * sync: thay bộ class `.hn-login-*` của hoa-nam-wireframe.css (sắp xoá) bằng
 * Box/UiCard + token. Card trắng radius 6 giữa canvas bgCanvas, logo HN +
 * kicker/tiêu đề giữ nguyên nội dung như bản wireframe.
 */
export function AuthShell({
  titleId,
  title,
  subtitle,
  loadingText,
  children,
}: AuthShellProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "grid",
        // Track phải minmax(0,...) — nếu để auto, grid track nở theo content
        // 460px và max-width:100% của card mất tác dụng, gây tràn ngang ở
        // mobile ≤460px (giữ nguyên gotcha từ bản wireframe).
        gridTemplateColumns: "minmax(0, 1fr)",
        placeItems: "center",
        padding: { xs: "20px 12px", md: "32px 20px" },
        backgroundColor: S.bgCanvas,
      }}
    >
      {loadingText ? (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: Z_INDEX.blockingLoading,
            display: "grid",
            placeItems: "center",
            backgroundColor: inkAlpha(0.38),
          }}
        >
          <Box
            sx={{
              minWidth: 280,
              padding: "18px 20px",
              textAlign: "center",
              backgroundColor: S.bgSurface,
              borderRadius: `${RADIUS.card}px`,
              boxShadow: S.shadowFloating,
            }}
          >
            <CircularProgress size={32} />
            <Box
              sx={{
                display: "block",
                marginTop: "12px",
                fontWeight: 600,
                color: S.textHigh,
              }}
            >
              {loadingText}
            </Box>
            <Box
              sx={{
                display: "block",
                marginTop: "4px",
                fontSize: 12,
                color: S.textMedium,
              }}
            >
              Hoa Nam WMS
            </Box>
          </Box>
        </Box>
      ) : null}

      <Box
        component="section"
        aria-labelledby={titleId}
        sx={{ width: "min(460px, 100%)" }}
      >
        <Box
          sx={{
            margin: "0 0 9px",
            color: S.textStrong,
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          Hoa Nam Tools{" "}
          <Box
            component="span"
            sx={{
              marginLeft: { xs: 0, md: "6px" },
              display: { xs: "block", md: "inline" },
              color: S.textMedium,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            WMS · Quản lý kho
          </Box>
        </Box>

        <UiCard disablePadding>
          <Box
            component="header"
            sx={{
              padding: { xs: "16px 16px 14px", md: "16px 20px 14px" },
              borderBottom: `1px solid ${S.divider}`,
              backgroundColor: S.bgSubtle,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 38,
                  height: 38,
                  display: "inline-grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                  border: `1.5px solid ${S.primary}`,
                  borderRadius: `${RADIUS.control}px`,
                  backgroundColor: S.primarySoft,
                  color: S.primary,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                HN
              </Box>
              <Box>
                <Box
                  component="h1"
                  id={titleId}
                  sx={{
                    margin: 0,
                    color: S.textHigh,
                    fontSize: 19,
                    lineHeight: 1.25,
                    fontWeight: 700,
                  }}
                >
                  {title}
                </Box>
                <Box
                  sx={{ marginTop: "3px", color: S.textMedium, fontSize: 12.5 }}
                >
                  {subtitle}
                </Box>
              </Box>
            </Box>
          </Box>

          <Box sx={{ padding: { xs: "18px 16px 20px", md: "18px 20px 20px" } }}>
            {children}
          </Box>
        </UiCard>
      </Box>
    </Box>
  );
}

/** Khối ghi chú viền đứt dưới form auth — thay `.hn-login-note`. */
export function AuthNote({
  children,
  sx,
}: {
  children: ReactNode;
  sx?: BoxProps["sx"];
}) {
  return (
    <Box
      sx={[
        {
          marginTop: "14px",
          padding: "9px 11px",
          border: `1px dashed ${S.border}`,
          borderRadius: `${RADIUS.control}px`,
          backgroundColor: S.bgSubtle,
          color: S.textMedium,
          fontSize: 11.5,
          "& a": { color: S.primary },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}
