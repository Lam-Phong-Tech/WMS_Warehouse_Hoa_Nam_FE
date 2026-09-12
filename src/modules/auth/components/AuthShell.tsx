import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Box, UiSpinner, type BoxProps } from "@/shared/ui";
import { flatIconClass } from "@/shared/ui/icons";
import { Z_INDEX } from "@/shared/ui/tokens";
import {
  AuthIllustration,
  type AuthIllustrationVariant,
} from "./AuthIllustration";

export interface AuthShellProps {
  /** id của h1 — section aria-labelledby trỏ về đây (giữ hợp đồng a11y cũ). */
  titleId: string;
  title: ReactNode;
  subtitle: ReactNode;
  /** Text overlay loading chặn toàn màn — null/undefined = không hiện. */
  loadingText?: string | null;
  /** Chọn asset minh hoạ cột trái theo màn (mặc định "login"). */
  illustration?: AuthIllustrationVariant;
  children: ReactNode;
}

/**
 * Token cục bộ của baseline SystemHNWeb.
 * Cố ý scope trong AUTH để không đổi màu/theme của các module nghiệp vụ khác.
 */
const HN_AUTH = {
  navy: "#003B63",
  cta: "#004E74",
  link: "#086590",
  pale: "#EAF5F8",
  line: "#D9E8EF",
  ink: "#12344B",
  muted: "#627C8E",
  surface: "#F5FAFC",
  success: "#16865B",
  warning: "#B97809",
  danger: "#C2413A",
  white: "#FFFFFF",
} as const;

function AuthBrand({ inverse = false }: { inverse?: boolean }) {
  const fg = inverse ? HN_AUTH.white : HN_AUTH.navy;
  const sub = inverse ? "rgba(255,255,255,.78)" : HN_AUTH.muted;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 42,
          height: 42,
          flex: "0 0 42px",
          display: "grid",
          placeItems: "center",
          borderRadius: "12px",
          backgroundColor: inverse ? "rgba(255,255,255,.14)" : HN_AUTH.pale,
          border: inverse
            ? "1px solid rgba(255,255,255,.24)"
            : `1px solid ${HN_AUTH.line}`,
        }}
      >
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 9.5 12 4l8 5.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1V9.5Z"
            fill={fg}
          />
        </svg>
      </Box>
      <Box>
        <Box
          sx={{
            color: fg,
            fontSize: 20,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: ".01em",
          }}
        >
          Hoa Nam WMS
        </Box>
        <Box
          sx={{
            marginTop: "3px",
            color: sub,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Warehouse Management System
        </Box>
      </Box>
    </Box>
  );
}

/**
 * AUTH shell đồng bộ với SystemHNWeb:
 * - palette navy/cyan của Hoa Nam;
 * - desktop 1920×1080: hero trái + form phải;
 * - tablet dọc 1440×2048 và viewport logic 768×1024: reflow thành header + form;
 * - chỉ đổi presentation, không chạm auth service/store/route/permission.
 */
export function AuthShell({
  titleId,
  title,
  subtitle,
  loadingText,
  illustration = "login",
  children,
}: AuthShellProps) {
  return (
    <Box
      component="main"
      data-ui-baseline="systemhnweb-auth-v1"
      sx={{
        minHeight: "100vh",
        backgroundColor: HN_AUTH.surface,
        color: HN_AUTH.ink,
        fontFamily:
          '"Public Sans", Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        display: { xs: "block", lg: "grid" },
        gridTemplateColumns: { lg: "minmax(0, 1.12fr) minmax(430px, .88fr)" },
      }}
    >
      {loadingText ? (
        <Box
          role="status"
          aria-live="polite"
          aria-busy="true"
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: Z_INDEX.blockingLoading,
            display: "grid",
            placeItems: "center",
            padding: "24px",
            backgroundColor: "rgba(0,59,99,.52)",
            backdropFilter: "blur(3px)",
          }}
        >
          <Box
            sx={{
              width: "min(360px, calc(100vw - 32px))",
              padding: "24px",
              textAlign: "center",
              backgroundColor: HN_AUTH.white,
              border: `1px solid ${HN_AUTH.line}`,
              borderRadius: "16px",
              boxShadow: "0 18px 44px rgba(0,59,99,.18)",
            }}
          >
            <UiSpinner size={34} />
            <Box
              sx={{
                marginTop: "14px",
                color: HN_AUTH.ink,
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.45,
              }}
            >
              {loadingText}
            </Box>
            <Box
              sx={{
                marginTop: "5px",
                color: HN_AUTH.muted,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Hoa Nam WMS
            </Box>
          </Box>
        </Box>
      ) : null}

      <Box
        aria-hidden
        sx={{
          minHeight: { lg: "100vh" },
          position: "relative",
          overflow: "hidden",
          display: { xs: "none", lg: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "44px 52px",
          background:
            "linear-gradient(135deg, #003B63 0%, #005E82 65%, #0B7898 100%)",
          color: HN_AUTH.white,
        }}
      >
        <Box sx={{ position: "relative", zIndex: 2 }}>
          <AuthBrand inverse />
        </Box>

        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
            flex: "1 1 auto",
            padding: "26px 0",
          }}
        >
          <Box
            sx={{
              position: "relative",
              width: "min(620px, 86%)",
              borderRadius: "24px",
              padding: "22px",
              backgroundColor: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.15)",
              boxShadow: "0 22px 50px rgba(0,35,61,.22)",
              backdropFilter: "blur(8px)",
              "& img": {
                maxHeight: "520px",
                filter: "saturate(.88) contrast(.98)",
              },
            }}
          >
            <AuthIllustration variant={illustration} />
          </Box>
        </Box>

        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            maxWidth: 560,
            color: "rgba(255,255,255,.82)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          Quản lý nhập, xuất, tồn kho và vận hành trên một hệ thống thống nhất.
        </Box>

        <Box
          sx={{
            position: "absolute",
            width: 520,
            height: 520,
            right: -180,
            top: -180,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,.10)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            width: 340,
            height: 340,
            left: -180,
            bottom: -170,
            borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,.06)",
          }}
        />
      </Box>

      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: HN_AUTH.white,
        }}
      >
        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            alignItems: "center",
            minHeight: 86,
            padding: { xs: "18px 20px", sm: "22px 32px" },
            borderBottom: `1px solid ${HN_AUTH.line}`,
            background:
              "linear-gradient(135deg, rgba(234,245,248,.95) 0%, #fff 72%)",
          }}
        >
          <AuthBrand />
        </Box>

        <Box
          sx={{
            flex: "1 1 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: {
              xs: "34px 20px 42px",
              sm: "58px 48px 64px",
              lg: "52px 56px",
              xl: "64px 76px",
            },
          }}
        >
          <Box
            component="section"
            aria-labelledby={titleId}
            sx={{
              width: "100%",
              maxWidth: 430,
              "& a": {
                color: HN_AUTH.link,
                fontWeight: 700,
                textDecoration: "none",
              },
              "& a:hover": { textDecoration: "underline" },
              "& .MuiInputLabel-root": {
                color: HN_AUTH.ink,
                fontWeight: 700,
              },
              "& .MuiOutlinedInput-root": {
                backgroundColor: HN_AUTH.white,
                borderRadius: "10px",
                "& fieldset": { borderColor: HN_AUTH.line },
                "&:hover fieldset": { borderColor: "#9FC5D3" },
                "&.Mui-focused fieldset": {
                  borderColor: HN_AUTH.link,
                  borderWidth: "1.5px",
                },
              },
              "& .MuiFormHelperText-root": {
                marginLeft: 0,
                marginRight: 0,
              },
              "& button[type='submit']": {
                minHeight: 44,
                borderRadius: "10px",
                backgroundColor: HN_AUTH.cta,
                boxShadow: "none",
                fontWeight: 800,
                textTransform: "none",
                "&:hover": {
                  backgroundColor: HN_AUTH.navy,
                  boxShadow: "0 7px 16px rgba(0,59,99,.18)",
                },
                "&:disabled": {
                  boxShadow: "none",
                },
              },
            }}
          >
            <Box sx={{ display: { xs: "none", lg: "block" }, marginBottom: "28px" }}>
              <AuthBrand />
            </Box>

            <Box
              component="h1"
              id={titleId}
              sx={{
                margin: 0,
                color: HN_AUTH.navy,
                fontSize: { xs: 28, sm: 30 },
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: "-.02em",
              }}
            >
              {title}
            </Box>
            <Box
              sx={{
                marginTop: "9px",
                color: HN_AUTH.muted,
                fontSize: 15,
                lineHeight: 1.6,
              }}
            >
              {subtitle}
            </Box>

            <Box
              sx={{
                marginTop: "28px",
                "& [role='alert']": {
                  borderRadius: "10px",
                },
              }}
            >
              {children}
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            padding: { xs: "0 20px 20px", sm: "0 32px 28px" },
            textAlign: "center",
            color: HN_AUTH.muted,
            fontSize: 12,
          }}
        >
          Hoa Nam WMS
        </Box>
      </Box>
    </Box>
  );
}

/** Link "Quay lại đăng nhập" căn giữa + mũi tên trái. */
export function AuthBackLink({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        "& a": {
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          color: HN_AUTH.link,
          fontSize: 15,
          fontWeight: 700,
          textDecoration: "none",
        },
        "& a:hover": { textDecoration: "underline" },
        "& i": { fontSize: 15, display: "inline-flex" },
      }}
    >
      <Link to="/login">
        <i className={flatIconClass("angle-small-left")} aria-hidden />
        {children}
      </Link>
    </Box>
  );
}

/** Khối ghi chú phụ của màn auth, scope theo baseline Hoa Nam. */
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
          marginTop: "16px",
          padding: "11px 13px",
          border: `1px dashed ${HN_AUTH.line}`,
          borderRadius: "10px",
          backgroundColor: HN_AUTH.pale,
          color: HN_AUTH.muted,
          fontSize: 12,
          lineHeight: 1.55,
          "& a": { color: HN_AUTH.link, fontWeight: 700 },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}
